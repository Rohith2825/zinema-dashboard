-- Formats: a song can have many formats (verticals, carousels, lyric video, flagship MV, AI MV, visualizer,
-- image-only video, audio-only), each with its own checklist and its own life after release.
-- Each format is backed by one deliverable, so file submit/review/approve keeps working as before.

-- 1) Format catalogue (org-wide).
create table format_types (
  kind      deliverable_kind primary key,
  label     text not null,
  stage     stage_key not null,
  position  int not null,
  checklist text[] not null default '{}'
);
insert into format_types(kind, label, stage, position, checklist) values
  ('vertical',       'Vertical',                    'promo',        10, array['Hook moment picked','Edit cut to the hook','Captions / on-screen lyrics','Cover frame chosen','Caption + song code + credits written','Exported 1080×1920']),
  ('carousel',       'Carousel',                    'promo',        20, array['Concept + copy approved','Slides designed','Lyrics / credits checked','Exported 1080×1350','Caption written']),
  ('lyric_video',    'Lyric video',                 'video',        30, array['Lyrics synced to the master','Typography + design','Credits card','Thumbnail','YouTube title, description, tags','Final export']),
  ('music_video',    'Flagship music video',        'video',        40, array['Treatment approved','Shoot / production','Edit locked','Colour grade','Synced to the master','Thumbnail','YouTube title, description, tags']),
  ('ai_music_video', 'AI music video',              'video',        50, array['Storyboard + prompts approved','Generations done','Edit locked','Synced to the master','AI tool licence / rights checked','Thumbnail','YouTube title, description, tags']),
  ('visualizer',     'Visualizer',                  'video',        60, array['Loop / design','Synced to the master','Thumbnail','YouTube title, description, tags']),
  ('static_image',   'Image only (static video)',   'video',        70, array['Artwork final','Rendered with the master audio','YouTube title, description, tags']),
  ('audio_only',     'Audio only (no visual)',      'distribution', 80, array['Master delivered','Metadata checked','Live on DSPs']);

-- 2) Formats per song.
create type format_status as enum ('planned','in_progress','in_review','approved','live','dropped');

create table song_formats (
  id               uuid primary key default gen_random_uuid(),
  song_id          uuid not null references songs(id) on delete cascade,
  deliverable_id   uuid unique references deliverables(id) on delete set null,
  kind             deliverable_kind not null references format_types(kind),
  label            text not null,
  status           format_status not null default 'planned',
  mandatory        boolean not null default false,
  owner_id         uuid references profiles(id),
  planned_at       timestamptz,
  went_live_at     timestamptz,
  live_url         text,
  drive_folder_url text,
  notes            text,
  created_by       uuid references profiles(id) default auth.uid(),
  created_at       timestamptz not null default now()
);
create index song_formats_song_idx on song_formats(song_id);

create table format_checklist (
  id        uuid primary key default gen_random_uuid(),
  format_id uuid not null references song_formats(id) on delete cascade,
  label     text not null,
  position  int not null,
  done_at   timestamptz,
  done_by   uuid references profiles(id)
);
create index format_checklist_format_idx on format_checklist(format_id);

-- 3) Seed a new format's checklist from its type.
create or replace function seed_format_checklist() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into format_checklist(format_id, label, position)
  select new.id, c.label, c.ord
  from format_types t, unnest(t.checklist) with ordinality c(label, ord)
  where t.kind = new.kind;
  return new;
end $$;
create trigger trg_seed_format_checklist after insert on song_formats for each row execute function seed_format_checklist();

-- 4) Going live stamps the status.
create or replace function format_live_status() returns trigger language plpgsql set search_path = public as $$
begin
  if new.went_live_at is not null and new.status <> 'dropped' then new.status := 'live'; end if;
  return new;
end $$;
create trigger trg_format_live before insert or update on song_formats for each row execute function format_live_status();

-- 5) File review status flows into the format status (never overrides live / dropped).
create or replace function sync_format_status() returns trigger language plpgsql security definer set search_path = public as $$
declare v_status format_status;
begin
  v_status := case new.status
    when 'submitted' then 'in_review'
    when 'in_review' then 'in_review'
    when 'changes_requested' then 'in_progress'
    when 'approved' then 'approved'
    else null end;
  if v_status is not null then
    update song_formats set status = v_status
     where deliverable_id = new.deliverable_id and status not in ('live','dropped');
  end if;
  return new;
end $$;
create trigger trg_sync_format_status after insert or update of status on deliverable_versions
  for each row execute function sync_format_status();

-- 6) Video-kind formats are now optional formats, not per-page templates.
delete from deliverable_templates where kind in ('lyric_video','visualizer','music_video');

create or replace function seed_page_templates(p_page uuid) returns void language sql set search_path = public as $$
  insert into deliverable_templates(page_id, stage, kind, required, min_count, allowed_mime, audit_skill) values
    (p_page,'lyrics','lyrics',true,1,null,'lyric-virality'),
    (p_page,'lyrics','sound_brief',true,1,null,null),
    (p_page,'music','rough_mix',true,1,array['audio/wav','audio/x-wav','audio/mpeg'],null),
    (p_page,'music','song_metadata',true,1,null,null),
    (p_page,'master_qc','master_wav',true,1,array['audio/wav','audio/x-wav'],'mix-audit'),
    (p_page,'master_qc','artwork',true,1,array['image/jpeg','image/png'],'artwork-audit'),
    (p_page,'master_qc','stems',false,1,null,null),
    (p_page,'promo','carousel',true,3,null,'carousel-audit'),
    (p_page,'promo','vertical',true,3,array['video/mp4','video/quicktime'],'video-audit')
  on conflict (page_id, stage, kind) do nothing;
$$;

-- 7) New song: stages + deliverable slots + the 6 mandatory formats (3 carousels, 3 verticals).
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

    insert into song_formats(song_id, deliverable_id, kind, label, mandatory, created_by)
    select new.id, d.id, d.kind, ft.label || ' ' || d.slot, true, new.created_by
    from deliverables d join format_types ft on ft.kind = d.kind
    where d.song_id = new.id and d.kind in ('carousel','vertical')
    order by ft.position, d.slot;
  end if;
  return new;
end $$;

-- 8) Add a format to a song (any time, including after release).
create or replace function add_song_format(p_song uuid, p_kind deliverable_kind, p_label text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_type format_types; v_slot int; v_deliv uuid; v_id uuid;
begin
  if not can_work_on_song(p_song) then raise exception 'You are not on this song''s team'; end if;
  select * into v_type from format_types where kind = p_kind;
  if v_type.kind is null then raise exception 'Unknown format type %', p_kind; end if;

  select coalesce(max(slot), 0) + 1 into v_slot from deliverables where song_id = p_song and kind = p_kind;
  insert into deliverables(song_id, stage, kind, slot, required)
  values (p_song, v_type.stage, p_kind, v_slot, false) returning id into v_deliv;

  insert into song_formats(song_id, deliverable_id, kind, label, mandatory, created_by)
  values (p_song, v_deliv, p_kind, coalesce(nullif(trim(p_label), ''), v_type.label || ' ' || v_slot), false, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- 9) Video gate: at least one approved (or live) video-stage format.
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
        select 1 from song_formats f join format_types ft on ft.kind = f.kind
        where f.song_id = p_song and ft.stage = 'video' and f.status in ('approved','live')));
$$;

-- 10) Calendar shows formats (planned date, or go-live date once live).
create or replace view calendar_events with (security_invoker = true) as
  select 'song_release'::text kind, s.page_id, s.id song_id, null::uuid ref_id,
         s.code || ' · ' || s.title as title, s.planned_release_date::timestamptz as at, 'planned' as state
    from songs s where s.planned_release_date is not null
  union all
  select 'song_release', s.page_id, s.id, d.id, s.code || ' · ' || s.title, d.release_date::timestamptz, coalesce(d.dsp_status,'released')
    from distribution_records d join songs s on s.id = d.song_id where d.release_date is not null
  union all
  select 'content', c.page_id, c.song_id, c.id, s.code || ' · ' || c.label, coalesce(c.went_live_at, c.planned_at),
         case when c.went_live_at is not null then 'live' else 'planned' end
    from content_slots c join songs s on s.id = c.song_id
  union all
  select 'task_due', t.page_id, t.song_id, t.id, t.title, t.due_at, t.status::text
    from tasks t where t.due_at is not null
  union all
  select 'deliverable_due', s.page_id, s.id, d.id, s.code || ' · ' || d.kind || ' ' || d.slot, d.due_at, 'due'
    from deliverables d join songs s on s.id = d.song_id where d.due_at is not null
  union all
  select 'format', s.page_id, s.id, f.id, s.code || ' · ' || f.label, coalesce(f.went_live_at, f.planned_at), f.status::text
    from song_formats f join songs s on s.id = f.song_id
   where coalesce(f.went_live_at, f.planned_at) is not null and f.status <> 'dropped';

-- 11) RLS + grants.
alter table format_types     enable row level security;
alter table song_formats     enable row level security;
alter table format_checklist enable row level security;

create policy ftypes_read  on format_types for select using (is_member_anywhere());
create policy ftypes_write on format_types for all
  using (exists (select 1 from profiles where id = auth.uid() and is_org_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_org_admin));

create policy formats_read   on song_formats for select using (can_see_song(song_id));
create policy formats_insert on song_formats for insert with check (can_work_on_song(song_id));
create policy formats_update on song_formats for update using (can_work_on_song(song_id)) with check (can_work_on_song(song_id));
create policy formats_delete on song_formats for delete using (not mandatory and can_work_on_song(song_id));

create policy fcheck_read  on format_checklist for select
  using (exists (select 1 from song_formats f where f.id = format_id and can_see_song(f.song_id)));
create policy fcheck_write on format_checklist for all
  using (exists (select 1 from song_formats f where f.id = format_id and can_work_on_song(f.song_id)))
  with check (exists (select 1 from song_formats f where f.id = format_id and can_work_on_song(f.song_id)));

revoke all on format_types, song_formats, format_checklist from anon;
grant select on format_types to authenticated;
grant insert, update, delete on format_types to authenticated;
grant select, insert, update, delete on song_formats, format_checklist to authenticated;
grant select on calendar_events to authenticated;
revoke select on calendar_events from anon;

revoke execute on function seed_format_checklist(), format_live_status(), sync_format_status() from public, anon, authenticated;
revoke execute on function add_song_format(uuid, deliverable_kind, text) from public, anon;
grant execute on function add_song_format(uuid, deliverable_kind, text), stage_gate_ok(uuid, stage_key) to authenticated;

-- 12) Activity log.
create trigger trg_log_formats after insert or update of status on song_formats
  for each row execute function log_activity();
