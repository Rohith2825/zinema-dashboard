-- If sending fails, un-mark the notification so it isn't recorded as emailed (applied 2026-11-23).
create or replace function release_notification_email(p_id uuid, p_token uuid) returns void
language sql security definer set search_path = public as $$
  update notifications set emailed_at = null where id = p_id and email_token = p_token;
$$;
revoke execute on function release_notification_email(uuid, uuid) from public;
grant execute on function release_notification_email(uuid, uuid) to anon, authenticated;
