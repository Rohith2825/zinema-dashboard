-- Zinema's own ISRC numbers, given out automatically.
--
-- Song (audio):  IN Z26 YY PSSSS   e.g. INZ26 26 1 0001  = first Tamil song of 2026
-- Video:         IN Z27 YY PSSST   e.g. INZ27 26 1 001 1 = lyric video of that same song
--   YY   two-digit year the song's number was given out (India time)
--   P    page: 1 Tamil, 2 Hindi, 3 Marathi, 4 Spiritual (pages.isrc_digit)
--   SSSS song number on that page in that year, from 0001
--   SSS  the same song number (last three digits), so a video's code points at its song
--   T    kind of video: 1 lyric video, 2 music video, 3 visualizer, 4 AI music video,
--        5 to 9 for a further video of a kind the song already has
-- ISRC allows only digits in the last five places, so the video kind is a digit, not a letter.

alter table pages add column if not exists isrc_digit smallint unique check (isrc_digit between 1 and 9);
update pages set isrc_digit = case slug when 'tamil' then 1 when 'hindi' then 2 when 'marathi' then 3 when 'spiritual' then 4 end
 where slug in ('tamil','hindi','marathi','spiritual') and isrc_digit is null;

alter table songs        add column if not exists isrc text unique check (isrc ~ '^INZ26[0-9]{7}$');
alter table song_formats add column if not exists isrc text unique check (isrc ~ '^INZ27[0-9]{7}$');

-- Last number given out per page and year. Only the functions below touch it.
create table if not exists isrc_counters (
  page_digit smallint not null,
  yy         smallint not null,
  last_seq   int not null,
  primary key (page_digit, yy)
);
alter table isrc_counters enable row level security;

create or replace function assign_song_isrc() returns trigger language plpgsql security definer set search_path = public as $$
declare v_digit smallint; v_yy smallint; v_seq int; v_code text;
begin
  if new.isrc is not null or coalesce((new.metadata->>'imported')::boolean, false) then return new; end if;
  select isrc_digit into v_digit from pages where id = new.page_id;
  if v_digit is null then return new; end if;            -- pages without a number (Main, Community) get none
  v_yy := to_char(now() at time zone 'Asia/Kolkata', 'YY')::smallint;
  loop
    insert into isrc_counters(page_digit, yy, last_seq) values (v_digit, v_yy, 1)
      on conflict (page_digit, yy) do update set last_seq = isrc_counters.last_seq + 1
      returning last_seq into v_seq;
    if v_seq > 9999 then raise exception 'This page has used all 9,999 ISRC numbers for the year.'; end if;
    v_code := 'INZ26' || lpad(v_yy::text, 2, '0') || v_digit || lpad(v_seq::text, 4, '0');
    exit when not exists (select 1 from distribution_records where isrc = v_code)
          and not exists (select 1 from songs where isrc = v_code);
  end loop;
  new.isrc := v_code;
  return new;
end $$;
create or replace trigger trg_assign_song_isrc before insert on songs for each row execute function assign_song_isrc();

create or replace function assign_video_isrc() returns trigger language plpgsql security definer set search_path = public as $$
declare v_song text; v_base text; v_try int[]; t int;
begin
  if new.isrc is not null or new.kind not in ('lyric_video','music_video','visualizer','ai_music_video') then return new; end if;
  select isrc into v_song from songs where id = new.song_id;
  -- needs a Zinema song number no higher than 999, so it fits in three digits
  if v_song is null or substr(v_song, 9, 1) <> '0' then return new; end if;
  v_base := 'INZ27' || substr(v_song, 6, 3) || substr(v_song, 10, 3);
  v_try := array[case new.kind when 'lyric_video' then 1 when 'music_video' then 2 when 'visualizer' then 3 else 4 end, 5, 6, 7, 8, 9];
  foreach t in array v_try loop
    if not exists (select 1 from song_formats where isrc = v_base || t) then
      new.isrc := v_base || t;
      return new;
    end if;
  end loop;
  return new;                                             -- every slot for this song is taken
end $$;
create or replace trigger trg_assign_video_isrc before insert on song_formats for each row execute function assign_video_isrc();

revoke execute on function assign_song_isrc(), assign_video_isrc() from public, anon, authenticated;

-- Once given, a number never changes (an ISRC is permanent).
create or replace function keep_isrc() returns trigger language plpgsql set search_path = public as $$
begin
  if old.isrc is not null then new.isrc := old.isrc; end if;
  return new;
end $$;
create or replace trigger trg_keep_song_isrc  before update of isrc on songs        for each row execute function keep_isrc();
create or replace trigger trg_keep_video_isrc before update of isrc on song_formats for each row execute function keep_isrc();
revoke execute on function keep_isrc() from public, anon, authenticated;
