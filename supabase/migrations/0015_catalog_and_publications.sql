-- Catalog: cover art + artist line per song, and "published on socials" per format (applied 2026-11-08).

-- 1) Catalog fields the team fills in on the dashboard.
alter table songs add column if not exists cover_url text;   -- Google Drive link to the cover art
alter table songs add column if not exists artists   text;   -- display line, e.g. "Sid Sriram, Shreya Ghoshal"

-- 2) Where each format has been published.
create table format_publications (
  id           uuid primary key default gen_random_uuid(),
  format_id    uuid not null references song_formats(id) on delete cascade,
  platform     text not null check (platform in
                 ('instagram','youtube','youtube_shorts','facebook','x','threads','snapchat','sharechat','moj','josh','spotify','apple_music','jiosaavn','other')),
  url          text,
  published_at timestamptz not null default now(),
  published_by uuid references profiles(id) default auth.uid(),
  unique (format_id, platform)
);
create index format_publications_format_idx on format_publications(format_id);

-- First publication marks the format live (and keeps its first link).
create or replace function format_published() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update song_formats
     set went_live_at = coalesce(went_live_at, new.published_at),
         live_url     = coalesce(live_url, new.url)
   where id = new.format_id and status <> 'dropped';
  return new;
end $$;
create trigger trg_format_published after insert on format_publications for each row execute function format_published();

alter table format_publications enable row level security;
create policy fpub_read  on format_publications for select
  using (exists (select 1 from song_formats f where f.id = format_id and can_see_song(f.song_id)));
create policy fpub_write on format_publications for all
  using (exists (select 1 from song_formats f where f.id = format_id and can_work_on_song(f.song_id)))
  with check (exists (select 1 from song_formats f where f.id = format_id and can_work_on_song(f.song_id)));
revoke all on format_publications from anon;
grant select, insert, update, delete on format_publications to authenticated;
revoke execute on function format_published() from public, anon, authenticated;

-- Activity: song_id comes from the format.
create or replace function log_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare v_row jsonb := to_jsonb(new); v_song uuid;
begin
  v_song := case tg_table_name
    when 'songs' then (v_row->>'id')::uuid
    when 'deliverable_versions' then deliverable_song((v_row->>'deliverable_id')::uuid)
    when 'reviews' then version_song((v_row->>'version_id')::uuid)
    when 'format_publications' then (select song_id from song_formats where id = (v_row->>'format_id')::uuid)
    else (v_row->>'song_id')::uuid end;
  insert into activity_log(actor_id, song_id, entity, entity_id, action, diff)
  values (auth.uid(), v_song, tg_table_name, (v_row->>'id')::uuid, lower(tg_op),
          case when tg_table_name = 'reviews' then jsonb_build_object('decision', v_row->>'decision')
               when tg_table_name = 'format_publications' then jsonb_build_object('platform', v_row->>'platform') end);
  return new;
end $$;
create trigger trg_log_publications after insert on format_publications for each row execute function log_activity();

-- 3) Released catalogue: each released song is already live on DSPs, so give it a live "Audio only" format.
with released as (
  select s.id from songs s
  where s.current_stage = 'live'
    and not exists (select 1 from song_formats f where f.song_id = s.id and f.kind = 'audio_only')
), d as (
  insert into deliverables(song_id, stage, kind, slot, required)
  select id, 'distribution', 'audio_only', 1, false from released
  returning id, song_id
)
insert into song_formats(song_id, deliverable_id, kind, label, status, mandatory)
select d.song_id, d.id, 'audio_only', 'Audio (DSPs)', 'live', false from d;

update format_checklist c set done_at = now()
  from song_formats f
 where f.id = c.format_id and f.kind = 'audio_only' and f.status = 'live' and c.done_at is null;
