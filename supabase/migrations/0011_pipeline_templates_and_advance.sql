-- Pipeline automation (applied 2026-11-07, with the log_activity fix from 0012 folded in).

-- 1) Default deliverable templates for every page (from the blueprint).
create or replace function seed_page_templates(p_page uuid) returns void language sql set search_path = public as $$
  insert into deliverable_templates(page_id, stage, kind, required, min_count, allowed_mime, audit_skill) values
    (p_page,'lyrics','lyrics',true,1,null,'lyric-virality'),
    (p_page,'lyrics','sound_brief',true,1,null,null),
    (p_page,'music','rough_mix',true,1,array['audio/wav','audio/x-wav','audio/mpeg'],null),
    (p_page,'music','song_metadata',true,1,null,null),
    (p_page,'master_qc','master_wav',true,1,array['audio/wav','audio/x-wav'],'mix-audit'),
    (p_page,'master_qc','artwork',true,1,array['image/jpeg','image/png'],'artwork-audit'),
    (p_page,'master_qc','stems',false,1,null,null),
    (p_page,'video','lyric_video',false,1,array['video/mp4','video/quicktime'],'video-audit'),
    (p_page,'video','visualizer',false,1,array['video/mp4','video/quicktime'],'video-audit'),
    (p_page,'video','music_video',false,1,array['video/mp4','video/quicktime'],'video-audit'),
    (p_page,'promo','carousel',true,3,null,'carousel-audit'),
    (p_page,'promo','vertical',true,3,array['video/mp4','video/quicktime'],'video-audit')
  on conflict (page_id, stage, kind) do nothing;
$$;
select seed_page_templates(id) from pages;

create or replace function seed_templates_on_page() returns trigger language plpgsql set search_path = public as $$
begin perform seed_page_templates(new.id); return new; end $$;
create trigger trg_seed_templates after insert on pages for each row execute function seed_templates_on_page();

-- 2) New song → stage rows + deliverable slots from its page's templates.
create or replace function init_song_pipeline() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into song_stages(song_id, stage, status, opened_at)
  select new.id, s, case when s = new.current_stage then 'open'::stage_status
                         when s < new.current_stage then 'approved'::stage_status
                         else 'locked'::stage_status end,
         case when s = new.current_stage then now() end
  from unnest(enum_range(null::stage_key)) s;

  if coalesce((new.metadata->>'imported')::boolean, false) = false then
    insert into deliverables(song_id, stage, kind, slot, required)
    select new.id, t.stage, t.kind, g, t.required
    from deliverable_templates t, generate_series(1, t.min_count) g
    where t.page_id = new.page_id;
  end if;
  return new;
end $$;
create trigger trg_init_song_pipeline after insert on songs for each row execute function init_song_pipeline();

insert into song_stages(song_id, stage, status)
select s.id, st, case when st < s.current_stage then 'approved'::stage_status
                      when st = s.current_stage then 'open'::stage_status else 'locked'::stage_status end
from songs s, unnest(enum_range(null::stage_key)) st
on conflict do nothing;

-- 3) Version numbers set by the database; a new version supersedes older unapproved ones.
create or replace function set_version_number() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(max(version), 0) + 1 into new.version from deliverable_versions where deliverable_id = new.deliverable_id;
  update deliverable_versions set status = 'superseded'
   where deliverable_id = new.deliverable_id and status in ('submitted','in_review','changes_requested');
  return new;
end $$;
alter table deliverable_versions alter column version set default 0;
create trigger trg_version_number before insert on deliverable_versions for each row execute function set_version_number();

-- 4) Gate: video stage needs at least one approved lyric video / visualizer / MV.
create or replace function stage_gate_ok(p_song uuid, p_stage stage_key) returns boolean
language sql stable set search_path = public as $$
  select not exists (
    select 1 from deliverable_templates t
    join songs s on s.page_id = t.page_id and s.id = p_song
    where t.stage = p_stage and t.required
      and (select count(distinct d.id) from deliverables d
           join deliverable_versions v on v.deliverable_id = d.id and v.status = 'approved'
           where d.song_id = p_song and d.kind = t.kind) < t.min_count
  )
  and (p_stage <> 'distribution' or exists (select 1 from distribution_records where song_id = p_song))
  and (p_stage <> 'video' or exists (
        select 1 from deliverables d join deliverable_versions v on v.deliverable_id = d.id and v.status = 'approved'
        where d.song_id = p_song and d.kind in ('lyric_video','visualizer','music_video')));
$$;

-- 5) Approver moves a song to its next stage (gate enforced).
create or replace function advance_song(p_song uuid) returns stage_key
language plpgsql security definer set search_path = public as $$
declare v_page uuid; v_stage stage_key; v_next stage_key; v_stages stage_key[] := enum_range(null::stage_key);
begin
  select page_id, current_stage into v_page, v_stage from songs where id = p_song for update;
  if v_page is null then raise exception 'Song not found'; end if;
  if not has_page_role(v_page, array['approver','page_admin']::page_role[]) then
    raise exception 'Only an approver can move a song to the next stage';
  end if;
  if v_stage = 'live' then raise exception 'Song is already live'; end if;
  if not stage_gate_ok(p_song, v_stage) then
    raise exception 'Not ready: required items for % are not all approved yet', v_stage;
  end if;
  v_next := v_stages[array_position(v_stages, v_stage) + 1];
  update song_stages set status = 'approved', approved_at = now(), approved_by = auth.uid() where song_id = p_song and stage = v_stage;
  update song_stages set status = 'open', opened_at = now() where song_id = p_song and stage = v_next;
  update songs set current_stage = v_next where id = p_song;
  insert into activity_log(actor_id, song_id, entity, entity_id, action, diff)
  values (auth.uid(), p_song, 'songs', p_song, 'stage_advanced', jsonb_build_object('from', v_stage, 'to', v_next));
  return v_next;
end $$;

-- 6) Activity log for the main actions.
create or replace function log_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare v_row jsonb := to_jsonb(new); v_song uuid;
begin
  v_song := case tg_table_name
    when 'songs' then (v_row->>'id')::uuid
    when 'deliverable_versions' then deliverable_song((v_row->>'deliverable_id')::uuid)
    when 'reviews' then version_song((v_row->>'version_id')::uuid)
    else (v_row->>'song_id')::uuid end;
  insert into activity_log(actor_id, song_id, entity, entity_id, action, diff)
  values (auth.uid(), v_song, tg_table_name, (v_row->>'id')::uuid, lower(tg_op),
          case when tg_table_name = 'reviews' then jsonb_build_object('decision', v_row->>'decision') end);
  return new;
end $$;
create trigger trg_log_songs     after insert on songs for each row execute function log_activity();
create trigger trg_log_versions  after insert on deliverable_versions for each row execute function log_activity();
create trigger trg_log_reviews   after insert on reviews for each row execute function log_activity();
create trigger trg_log_dist      after insert on distribution_records for each row execute function log_activity();
create trigger trg_log_tasks     after insert on tasks for each row execute function log_activity();

revoke execute on function seed_page_templates(uuid), seed_templates_on_page(), init_song_pipeline(),
  set_version_number(), log_activity() from public, anon, authenticated;
grant execute on function advance_song(uuid), stage_gate_ok(uuid, stage_key) to authenticated;
revoke execute on function advance_song(uuid) from public, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update, delete on activity_log from authenticated;
