-- ISRC for songs on pages without their own number (Main, Community): use the song's language.
-- A Tamil song on the Main page is numbered in the Tamil series (1), Hindi 2, Marathi 3,
-- devotional / spiritual 4. A song with none of these languages still gets no number.
-- The number is also given later, if a song had none and its language or page is then set.

create or replace function assign_song_isrc() returns trigger language plpgsql security definer set search_path = public as $$
declare v_digit smallint; v_yy smallint; v_seq int; v_code text; v_lang text := lower(coalesce(new.metadata->>'language', ''));
begin
  if new.isrc is not null or coalesce((new.metadata->>'imported')::boolean, false) then return new; end if;
  -- a song that already carries a distributor's ISRC keeps that one
  if tg_op = 'UPDATE' and exists (select 1 from distribution_records where song_id = new.id) then return new; end if;
  select isrc_digit into v_digit from pages where id = new.page_id;
  if v_digit is null then
    v_digit := case when v_lang like '%tamil%' then 1 when v_lang like '%hindi%' then 2 when v_lang like '%marathi%' then 3
                    when v_lang like '%devotional%' or v_lang like '%spiritual%' then 4 end;
  end if;
  if v_digit is null then return new; end if;
  v_yy := to_char(now() at time zone 'Asia/Kolkata', 'YY')::smallint;
  loop
    insert into isrc_counters(page_digit, yy, last_seq) values (v_digit, v_yy, 1)
      on conflict (page_digit, yy) do update set last_seq = isrc_counters.last_seq + 1
      returning last_seq into v_seq;
    if v_seq > 9999 then raise exception 'This series has used all 9,999 ISRC numbers for the year.'; end if;
    v_code := 'INZ26' || lpad(v_yy::text, 2, '0') || v_digit || lpad(v_seq::text, 4, '0');
    exit when not exists (select 1 from distribution_records where isrc = v_code)
          and not exists (select 1 from songs where isrc = v_code);
  end loop;
  new.isrc := v_code;
  return new;
end $$;
create or replace trigger trg_assign_song_isrc before insert or update of metadata, page_id on songs for each row execute function assign_song_isrc();

-- Number the new songs that were created before this rule.
update songs set metadata = metadata
 where isrc is null and not coalesce((metadata->>'imported')::boolean, false);
