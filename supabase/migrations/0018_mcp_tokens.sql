-- Zinema OS MCP: personal access tokens for AI clients that can't do OAuth (applied 2026-11-11).
-- Only a SHA-256 hash is stored; the token itself is shown once when created.
create table mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade default auth.uid(),
  name         text not null,
  prefix       text not null,                 -- first characters, to recognise it in the list
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index mcp_tokens_user_idx on mcp_tokens(user_id);

alter table mcp_tokens enable row level security;
create policy mcp_tokens_read   on mcp_tokens for select using (user_id = auth.uid());
create policy mcp_tokens_insert on mcp_tokens for insert with check (user_id = auth.uid());
create policy mcp_tokens_update on mcp_tokens for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mcp_tokens_delete on mcp_tokens for delete using (user_id = auth.uid());
revoke all on mcp_tokens from anon;
grant select, insert, update, delete on mcp_tokens to authenticated;

-- The MCP endpoint calls this before it knows who the caller is: hash in, user out.
create or replace function mcp_token_user(p_hash text) returns uuid
language sql security definer set search_path = public as $$
  update mcp_tokens set last_used_at = now()
   where token_hash = p_hash and revoked_at is null
  returning user_id;
$$;
revoke execute on function mcp_token_user(text) from public;
grant execute on function mcp_token_user(text) to anon, authenticated;

-- Work done through an AI client is labelled as such in the activity log.
create or replace function log_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare v_row jsonb := to_jsonb(new); v_song uuid;
  v_agent boolean := coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'x-zinema-via', '') = 'mcp';
begin
  v_song := case tg_table_name
    when 'songs' then (v_row->>'id')::uuid
    when 'deliverable_versions' then deliverable_song((v_row->>'deliverable_id')::uuid)
    when 'reviews' then version_song((v_row->>'version_id')::uuid)
    when 'format_publications' then (select song_id from song_formats where id = (v_row->>'format_id')::uuid)
    else (v_row->>'song_id')::uuid end;
  insert into activity_log(actor_id, actor_type, song_id, entity, entity_id, action, diff)
  values (auth.uid(), case when v_agent then 'agent'::actor_type else 'user'::actor_type end,
          v_song, tg_table_name, (v_row->>'id')::uuid, lower(tg_op),
          case when tg_table_name = 'reviews' then jsonb_build_object('decision', v_row->>'decision')
               when tg_table_name = 'format_publications' then jsonb_build_object('platform', v_row->>'platform') end);
  return new;
end $$;
