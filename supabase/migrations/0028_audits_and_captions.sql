-- Audit skills + caption writer.

-- 1) Who ran an audit, and how (the dashboard, or an AI assistant through the bridge).
alter table audit_runs add column if not exists created_by  uuid references profiles(id) default auth.uid();
alter table audit_runs add column if not exists created_via actor_type not null default 'user';
create index if not exists audit_runs_created_by_idx on audit_runs(created_by);

-- 2) Artwork rules per page, next to the loudness rules that are already there.
insert into audit_thresholds(page_id, kind, rules)
select id, 'artwork', '{"size_px":3000,"min_px":1400,"max_mb":10,"formats":["jpeg","png"]}'::jsonb from pages
on conflict do nothing;

create or replace function seed_artwork_thresholds() returns trigger language plpgsql set search_path = public as $$
begin
  insert into audit_thresholds(page_id, kind, rules)
  values (new.id, 'artwork', '{"size_px":3000,"min_px":1400,"max_mb":10,"formats":["jpeg","png"]}'::jsonb)
  on conflict do nothing;
  return new;
end $$;
create or replace trigger trg_seed_artwork_thresholds after insert on pages for each row execute function seed_artwork_thresholds();
revoke execute on function seed_artwork_thresholds() from public, anon, authenticated;

-- 3) Caption drafts for a song. Every draft is kept; the newest one is shown.
create table if not exists song_captions (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references songs(id) on delete cascade,
  captions    jsonb not null,
  brief       text,
  created_by  uuid references profiles(id),
  created_via actor_type not null default 'user',
  created_at  timestamptz not null default now()
);
create index if not exists song_captions_song_idx on song_captions(song_id, created_at desc);
create index if not exists song_captions_created_by_idx on song_captions(created_by);
alter table song_captions enable row level security;
create policy captions_read   on song_captions for select using (can_see_song(song_id));
create policy captions_insert on song_captions for insert with check (can_work_on_song(song_id) and created_by = (select auth.uid()));
create policy captions_delete on song_captions for delete using (can_work_on_song(song_id));
