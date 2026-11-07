-- Song codes count per page: TAM-0001, TAM-0002 … HIN-0001 … (applied 2026-11-07)
create or replace function set_song_code() returns trigger language plpgsql set search_path = public as $$
declare v_prefix text; v_next int;
begin
  if new.code is null then
    select code_prefix into v_prefix from pages where id = new.page_id;
    perform pg_advisory_xact_lock(hashtext('song_code_' || v_prefix));
    select coalesce(max(split_part(code, '-', 2)::int), 0) + 1 into v_next
      from songs where code like v_prefix || '-%';
    new.code := v_prefix || '-' || lpad(v_next::text, 4, '0');
  end if;
  return new;
end $$;
revoke execute on function set_song_code() from public, anon, authenticated;
drop sequence if exists song_seq;

-- Renumber the imported catalogue: legacy (DistroKid) first, then PDL.
update songs set code = 'TMP-' || id;
with ordered as (
  select s.id, p.code_prefix,
         row_number() over (partition by p.code_prefix order by d.legacy desc, s.created_at, s.title) n
  from songs s join pages p on p.id = s.page_id join distribution_records d on d.song_id = s.id
)
update songs s set code = o.code_prefix || '-' || lpad(o.n::text, 4, '0') from ordered o where o.id = s.id;
