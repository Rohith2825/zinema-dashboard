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
revoke execute on function log_activity() from public, anon, authenticated;
