-- Attendance: geotagged, selfie-verified check-ins near an office (applied 2026-11-12).

create table office_locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  maps_url   text,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  radius_m   int not null default 1000 check (radius_m between 50 and 20000),
  active     boolean not null default true,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Who has to mark attendance. Only rights owners decide.
create table attendance_members (
  user_id    uuid primary key references profiles(id) on delete cascade,
  added_by   uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table attendance (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  kind            text not null check (kind in ('check_in','check_out')),
  day             date not null,                         -- India date
  at              timestamptz not null default now(),
  office_id       uuid not null references office_locations(id),
  lat             double precision not null,
  lng             double precision not null,
  accuracy_m      double precision,
  distance_m      int not null,                          -- from the office, at the time
  selfie_file_id  text not null,                         -- Google Drive file (private folder)
  unique (user_id, day, kind)
);
create index attendance_day_idx on attendance(day);

alter table office_locations   enable row level security;
alter table attendance_members enable row level security;
alter table attendance         enable row level security;

create policy offices_read  on office_locations for select using (is_member_anywhere());
create policy offices_write on office_locations for all using (is_rights_owner()) with check (is_rights_owner());
create policy attmem_read   on attendance_members for select using (user_id = auth.uid() or is_rights_owner());
create policy attmem_write  on attendance_members for all using (is_rights_owner()) with check (is_rights_owner());
-- Rows are only written by mark_attendance(); people see their own, owners see everyone's.
create policy attendance_read on attendance for select using (user_id = auth.uid() or is_rights_owner());

revoke all on office_locations, attendance_members, attendance from anon;
grant select, insert, update, delete on office_locations, attendance_members to authenticated;
grant select on attendance to authenticated;

create or replace function distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- The only way to record attendance: checks the person is enrolled and inside an office radius.
create or replace function mark_attendance(p_kind text, p_lat double precision, p_lng double precision, p_accuracy double precision, p_selfie_file_id text)
returns attendance language plpgsql security definer set search_path = public as $$
declare v_office office_locations; v_dist double precision; v_day date := (now() at time zone 'Asia/Kolkata')::date; v_row attendance;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from attendance_members where user_id = auth.uid()) then
    raise exception 'Attendance isn''t switched on for you';
  end if;
  if p_kind not in ('check_in','check_out') then raise exception 'Unknown attendance type'; end if;
  if coalesce(p_selfie_file_id, '') = '' then raise exception 'A selfie is required'; end if;
  if p_lat is null or p_lng is null then raise exception 'Location is required'; end if;

  select o.* into v_office from office_locations o where o.active
   order by distance_m(p_lat, p_lng, o.lat, o.lng) limit 1;
  if v_office.id is null then raise exception 'No office locations are set up yet'; end if;
  v_dist := distance_m(p_lat, p_lng, v_office.lat, v_office.lng);
  if v_dist > v_office.radius_m then
    raise exception 'You are % m from % — attendance needs you within % m', round(v_dist), v_office.name, v_office.radius_m;
  end if;
  if coalesce(p_accuracy, 0) > 2000 then
    raise exception 'Your location is too imprecise (±% m). Turn on GPS / precise location and try again', round(p_accuracy);
  end if;
  if p_kind = 'check_out' and not exists (select 1 from attendance where user_id = auth.uid() and day = v_day and kind = 'check_in') then
    raise exception 'Check in first';
  end if;
  if exists (select 1 from attendance where user_id = auth.uid() and day = v_day and kind = p_kind) then
    raise exception 'Already marked for today';
  end if;

  insert into attendance(user_id, kind, day, office_id, lat, lng, accuracy_m, distance_m, selfie_file_id)
  values (auth.uid(), p_kind, v_day, v_office.id, p_lat, p_lng, p_accuracy, round(v_dist), p_selfie_file_id)
  returning * into v_row;
  return v_row;
end $$;
revoke execute on function mark_attendance(text, double precision, double precision, double precision, text) from public, anon;
grant execute on function mark_attendance(text, double precision, double precision, double precision, text), distance_m(double precision, double precision, double precision, double precision) to authenticated;
