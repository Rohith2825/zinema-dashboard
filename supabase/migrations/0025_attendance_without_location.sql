-- Attendance without the location check (applied 2026-11-23).
-- Drops the GPS / office geofence: enrolled people check in / out with a time-stamped selfie,
-- from anywhere. The selfie is still required and saved privately to Drive. The location columns
-- become nullable so the geofence can be switched back on later without losing any rows.

alter table attendance
  alter column office_id  drop not null,
  alter column lat        drop not null,
  alter column lng        drop not null,
  alter column distance_m drop not null;

-- Replace the 5-arg (location + selfie) function with a selfie-only one. mark_attendance() is
-- still the only way a row is written; enrolment, the selfie, and once-a-day rules all stay.
drop function if exists mark_attendance(text, double precision, double precision, double precision, text);

create or replace function mark_attendance(p_kind text, p_selfie_file_id text)
returns attendance language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'Asia/Kolkata')::date; v_row attendance;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from attendance_members where user_id = auth.uid()) then
    raise exception 'Attendance isn''t switched on for you';
  end if;
  if p_kind not in ('check_in','check_out') then raise exception 'Unknown attendance type'; end if;
  if coalesce(p_selfie_file_id, '') = '' then raise exception 'A selfie is required'; end if;
  if p_kind = 'check_out' and not exists (select 1 from attendance where user_id = auth.uid() and day = v_day and kind = 'check_in') then
    raise exception 'Check in first';
  end if;
  if exists (select 1 from attendance where user_id = auth.uid() and day = v_day and kind = p_kind) then
    raise exception 'Already marked for today';
  end if;

  insert into attendance(user_id, kind, day, selfie_file_id)
  values (auth.uid(), p_kind, v_day, p_selfie_file_id)
  returning * into v_row;
  return v_row;
end $$;
revoke execute on function mark_attendance(text, text) from public, anon;
grant execute on function mark_attendance(text, text) to authenticated;
