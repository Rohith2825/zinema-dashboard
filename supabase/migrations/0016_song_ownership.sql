-- Ownership label per song (applied 2026-11-10).
-- "original"  = Zinema Original: made and owned by Zinema.
-- "community" = Community: released through Zinema but not owned by Zinema.
-- Independent of the page a song sits on; used to classify royalty splits.
create type song_ownership as enum ('original', 'community');
alter table songs add column if not exists ownership song_ownership not null default 'original';
create index if not exists songs_ownership_idx on songs(ownership);
