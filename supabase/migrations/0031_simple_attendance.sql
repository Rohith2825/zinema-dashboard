-- Attendance made simple: one tap to check in with a note of the day's tasks, one tap to check out.
-- No selfie, no location, and nobody has to be switched on first: anyone on the team can use it.
-- attendance_members now only means "expected", so the owners' register can show who hasn't checked in.

alter table attendance alter column selfie_file_id drop not null;
alter table attendance add column if not exists note text;

create or replace function log_attendance(p_kind text, p_note text default null)
returns attendance language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'Asia/Kolkata')::date; v_row attendance; v_note text := nullif(left(btrim(coalesce(p_note, '')), 2000), '');
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not is_member_anywhere() then raise exception 'You don''t have access to Zinema OS yet'; end if;
  if p_kind not in ('check_in','check_out') then raise exception 'Unknown attendance type'; end if;
  if p_kind = 'check_out' and not exists (select 1 from attendance where user_id = auth.uid() and day = v_day and kind = 'check_in') then
    raise exception 'Check in first';
  end if;
  if exists (select 1 from attendance where user_id = auth.uid() and day = v_day and kind = p_kind) then
    raise exception 'Already done for today';
  end if;
  insert into attendance(user_id, kind, day, note) values (auth.uid(), p_kind, v_day, v_note) returning * into v_row;
  return v_row;
end $$;

-- Change today's task list (check-in note) or what got done (check-out note) during the same day.
create or replace function set_attendance_note(p_kind text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update attendance set note = nullif(left(btrim(coalesce(p_note, '')), 2000), '')
   where user_id = auth.uid() and kind = p_kind and day = (now() at time zone 'Asia/Kolkata')::date;
  if not found then raise exception 'Nothing to update for today'; end if;
end $$;

revoke execute on function log_attendance(text, text), set_attendance_note(text, text) from public, anon;
grant execute on function log_attendance(text, text), set_attendance_note(text, text) to authenticated;
-- The selfie version is retired.
revoke execute on function mark_attendance(text, text) from authenticated;
