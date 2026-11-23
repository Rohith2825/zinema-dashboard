-- Messages an admin or owner writes to the team. They land in each person's Inbox and are emailed
-- from the brand address (TEAM_EMAIL_FROM, default brands@zinema.music) by the app, so the
-- automatic notification email (notifications@) is skipped for them.

create table if not exists team_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references profiles(id) default auth.uid(),
  subject     text not null,
  body        text not null,
  page_id     uuid references pages(id) on delete set null,   -- null = everyone
  recipients  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists team_messages_sender_idx on team_messages(sender_id);
create index if not exists team_messages_page_idx on team_messages(page_id);
alter table team_messages enable row level security;
create policy team_messages_read on team_messages for select
  using (sender_id = (select auth.uid()) or exists (select 1 from profiles where id = (select auth.uid()) and is_org_admin));

-- The only way a message is written. Returns who to email.
create or replace function post_team_message(p_subject text, p_body text, p_page uuid default null)
returns table (message_id uuid, to_email text, to_name text, wants_email boolean)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_subject text := btrim(coalesce(p_subject, '')); v_body text := btrim(coalesce(p_body, '')); v_n int;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_org_admin) then
    raise exception 'Only admins and owners can message the team';
  end if;
  if length(v_subject) < 3 or length(v_subject) > 150 then raise exception 'The subject needs 3 to 150 characters'; end if;
  if length(v_body) < 3 or length(v_body) > 5000 then raise exception 'The message needs 3 to 5000 characters'; end if;

  -- everyone with access, or (for one page) its members plus people who have every page
  create temporary table _to on commit drop as
    select p.id, p.email, coalesce(p.nickname, p.full_name) as name, p.email_notifications
      from profiles p
     where p.id <> auth.uid()
       and (p.is_org_admin
            or exists (select 1 from all_page_roles a where a.user_id = p.id)
            or exists (select 1 from page_members m where m.user_id = p.id and (p_page is null or m.page_id = p_page)));
  select count(*) into v_n from _to;
  if v_n = 0 then raise exception 'Nobody else is on that page yet'; end if;

  insert into team_messages(sender_id, subject, body, page_id, recipients) values (auth.uid(), v_subject, v_body, p_page, v_n) returning id into v_id;
  insert into notifications(user_id, kind, body)
    select t.id, 'team_message', left(v_subject || ': ' || v_body, 400) from _to t;
  return query select v_id, t.email, t.name, t.email_notifications from _to t;
end $$;
revoke execute on function post_team_message(text, text, uuid) from public, anon;
grant execute on function post_team_message(text, text, uuid) to authenticated;

-- Team messages are emailed by the app from the brand address, not by the notification mailer.
create or replace function queue_notification_email() returns trigger language plpgsql security definer set search_path = public, net as $$
begin
  if new.kind = 'team_message' then return new; end if;
  if exists (select 1 from profiles where id = new.user_id and email_notifications) then
    perform net.http_post(
      url := 'https://dashboard.zinema.music/api/notify',
      body := jsonb_build_object('id', new.id, 'token', new.email_token),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 8000);
  end if;
  return new;
exception when others then
  return new;
end $$;
