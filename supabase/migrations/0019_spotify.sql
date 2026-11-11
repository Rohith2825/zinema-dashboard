-- Spotify details per song (applied 2026-11-11). Filled by "Sync from Spotify", matched on ISRC.
alter table songs add column if not exists spotify_track_id  text unique;
alter table songs add column if not exists spotify_url       text;
alter table songs add column if not exists cover_image_url   text;   -- public image (Spotify); a Drive cover_url still wins
alter table songs add column if not exists duration_ms       int;
alter table songs add column if not exists spotify_synced_at timestamptz;
