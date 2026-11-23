-- Email notifications (applied 2026-11-23).
-- Every in-app notification can also go out as an email. The database pings the app with the
-- notification's id and a one-time token; the app trades those for the message and sends it.
-- No shared secret is needed: the token exists only in the row and in that one request.

create extension if not exists pg_net;

alter table profiles      add column if not exists email_notifications boolean not null default true;
alter table notifications add column if not exists email_token uuid not null default gen_random_uuid();
alter table notifications add column if not exists emailed_at  timestamptz;

-- 1) More events worth telling people about.
-- A file was submitted: tell the assigned checker (if one is set and it isn't the submitter).
create or replace function notify_file_submitted() returns trigger language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select dl.song_id, dl.kind, dl.slot, dl.checker_id into d from deliverables dl where dl.id = new.deliverable_id;
  if d.checker_id is not null and d.checker_id <> new.submitted_by then
    insert into notifications(user_id, song_id, kind, body)
    values (d.checker_id, d.song_id, 'file_to_check', initcap(replace(d.kind::text, '_', ' ')) || ' v' || new.version || ' is waiting for your check');
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_file_submitted on deliverable_versions;
create trigger trg_notify_file_submitted after insert on deliverable_versions for each row execute function notify_file_submitted();

-- A file was reviewed: tell the person who submitted it.
create or replace function notify_file_reviewed() returns trigger language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if new.decision not in ('approve', 'request_changes') then return new; end if;
  select dv.submitted_by, dv.version, dl.song_id, dl.kind into v
    from deliverable_versions dv join deliverables dl on dl.id = dv.deliverable_id where dv.id = new.version_id;
  if v.submitted_by is not null and v.submitted_by <> new.reviewer_id then
    insert into notifications(user_id, song_id, kind, body)
    values (v.submitted_by, v.song_id,
            case when new.decision = 'approve' then 'file_approved' else 'changes_requested' end,
            initcap(replace(v.kind::text, '_', ' ')) || ' v' || v.version ||
            case when new.decision = 'approve' then ' was approved' else ' needs changes' || coalesce(': ' || left(new.comments, 160), '') end);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_file_reviewed on reviews;
create trigger trg_notify_file_reviewed after insert on reviews for each row execute function notify_file_reviewed();

-- 2) Hand each new notification to the app for emailing (sent after the transaction commits).
create or replace function queue_notification_email() returns trigger language plpgsql security definer set search_path = public, net as $$
begin
  if exists (select 1 from profiles where id = new.user_id and email_notifications) then
    perform net.http_post(
      url := 'https://dashboard.zinema.music/api/notify',
      body := jsonb_build_object('id', new.id, 'token', new.email_token),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 8000);
  end if;
  return new;
exception when others then
  return new; -- never let an email problem block the action that caused the notification
end $$;
drop trigger if exists trg_queue_notification_email on notifications;
create trigger trg_queue_notification_email after insert on notifications for each row execute function queue_notification_email();

-- 3) The app trades (id, token) for the message, once.
create or replace function claim_notification_email(p_id uuid, p_token uuid)
returns table (to_email text, to_name text, kind text, body text, song_code text, song_title text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with claimed as (
    update notifications n set emailed_at = now()
     where n.id = p_id and n.email_token = p_token and n.emailed_at is null
    returning n.user_id, n.song_id, n.kind, n.body
  )
  select p.email, coalesce(p.nickname, p.full_name), c.kind, c.body, s.code, s.title
    from claimed c join profiles p on p.id = c.user_id left join songs s on s.id = c.song_id
   where p.email_notifications;
end $$;
revoke execute on function claim_notification_email(uuid, uuid) from public;
grant execute on function claim_notification_email(uuid, uuid) to anon, authenticated;
revoke execute on function notify_file_submitted(), notify_file_reviewed(), queue_notification_email() from public, anon, authenticated;
