-- Performance numbers per song, and rules for the video and carousel audits.

-- 1) One number per song / platform / link / metric / day. Pulled from YouTube, or saved by a person or an assistant.
create table if not exists song_metrics (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references songs(id) on delete cascade,
  platform    text not null check (platform in
                ('instagram','youtube','youtube_shorts','facebook','x','threads','snapchat','sharechat','moj','josh','spotify','apple_music','jiosaavn','other')),
  url         text not null default '',
  metric      text not null check (metric in ('views','likes','comments','shares','saves','streams','listeners','followers','reach')),
  value       bigint not null check (value >= 0),
  captured_on date not null default ((now() at time zone 'Asia/Kolkata')::date),
  source      text not null default 'manual' check (source in ('youtube_api','agent','manual')),
  created_by  uuid references profiles(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (song_id, platform, url, metric, captured_on)
);
create index if not exists song_metrics_song_idx on song_metrics(song_id, captured_on desc);
create index if not exists song_metrics_created_by_idx on song_metrics(created_by);
alter table song_metrics enable row level security;
create policy metrics_read   on song_metrics for select using (can_see_song(song_id));
create policy metrics_insert on song_metrics for insert with check (can_work_on_song(song_id));
create policy metrics_update on song_metrics for update using (can_work_on_song(song_id)) with check (can_work_on_song(song_id));

-- 2) Editable rules for the new audits (the code has the same values as a fallback).
insert into audit_thresholds(page_id, kind, rules)
select p.id, k.kind::deliverable_kind, k.rules::jsonb from pages p cross join (values
  ('vertical',       '{"aspect":[9,16],"min_short_px":720,"warn_short_px":1080,"fps":[24,60],"duration_s":[5,90],"duration_warn_s":180,"min_mbps":3,"codecs":["H.264","H.265 (HEVC)"]}'),
  ('lyric_video',    '{"aspect":[16,9],"min_short_px":720,"warn_short_px":1080,"fps":[24,60],"duration_s":[20,900],"duration_warn_s":1200,"min_mbps":5,"codecs":["H.264","H.265 (HEVC)","ProRes"]}'),
  ('visualizer',     '{"aspect":[16,9],"min_short_px":720,"warn_short_px":1080,"fps":[24,60],"duration_s":[20,900],"duration_warn_s":1200,"min_mbps":5,"codecs":["H.264","H.265 (HEVC)","ProRes"]}'),
  ('music_video',    '{"aspect":[16,9],"min_short_px":720,"warn_short_px":1080,"fps":[24,60],"duration_s":[20,900],"duration_warn_s":1200,"min_mbps":5,"codecs":["H.264","H.265 (HEVC)","ProRes"]}'),
  ('ai_music_video', '{"aspect":[16,9],"min_short_px":720,"warn_short_px":1080,"fps":[24,60],"duration_s":[20,900],"duration_warn_s":1200,"min_mbps":5,"codecs":["H.264","H.265 (HEVC)","ProRes"]}'),
  ('carousel',       '{"slides":[3,20],"ratios":[[4,5],[1,1],[3,4]],"min_width_px":1080}')
) as k(kind, rules)
on conflict do nothing;
