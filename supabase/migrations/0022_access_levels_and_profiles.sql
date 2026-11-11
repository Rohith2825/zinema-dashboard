-- New access model + personal profiles. NOT APPLIED YET: waiting for approval of the Supabase prompt (written 2026-11-12).
--
--   Owner      rights_owners            sees and does everything, incl. royalty splits and attendance; approves
--   Admin      profiles.is_org_admin    every page; manages people; approves; no owner-only data
--   Core team  role 'core'              makes AND checks on their pages (never their own file); cannot approve a stage
--   Viewer     role 'viewer'            read-only on their pages
--
-- Core team and viewers are scoped to chosen pages (page_members) or to every page (all_page_roles).
-- The old per-page roles (page_admin, approver, checker, maker) are folded into 'core'.

-- 1) Profiles: nickname, @handle, bio.
alter table profiles add column if not exists nickname text check (char_length(nickname) <= 40);
alter table profiles add column if not exists handle   text check (handle ~ '^[a-z0-9._]{3,30}$');
alter table profiles add column if not exists bio      text check (char_length(bio) <= 300);
create unique index if not exists profiles_handle_key on profiles (handle);

-- Everyone starts with a handle from their email (made unique with a number if needed).
with base as (
  select id, left(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g'), 26) h from profiles where handle is null
), numbered as (
  select id, case when char_length(h) < 3 then h || 'zinema' else h end h,
         row_number() over (partition by h order by id) n from base
)
update profiles p set handle = case when n.n = 1 then n.h else n.h || n.n end from numbered n where p.id = n.id;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_base text := left(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9._]', '', 'g'), 24);
        v_handle text; v_n int := 0;
begin
  if char_length(v_base) < 3 then v_base := v_base || 'zinema'; end if;
  v_handle := v_base;
  while exists (select 1 from profiles where handle = v_handle) loop
    v_n := v_n + 1; v_handle := v_base || v_n;
  end loop;
  insert into profiles (id, full_name, email, handle)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, v_handle)
  on conflict (id) do nothing;
  return new;
end $$;

-- 2) "All pages" access.
create table all_page_roles (
  user_id    uuid primary key references profiles(id) on delete cascade,
  role       page_role not null check (role in ('core','viewer')),
  granted_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table all_page_roles enable row level security;

-- 3) Fold the old roles into core; one role per person per page.
insert into page_members (user_id, page_id, role)
select distinct user_id, page_id, 'core'::page_role from page_members where role in ('page_admin','approver','checker','maker')
on conflict do nothing;
delete from page_members where role in ('page_admin','approver','checker','maker');
delete from page_members v using page_members c
 where v.role = 'viewer' and c.role = 'core' and c.user_id = v.user_id and c.page_id = v.page_id;
create unique index if not exists page_members_one_role on page_members (user_id, page_id);
alter table page_members add constraint page_members_role_check check (role in ('core','viewer'));

-- 4) One place that answers "can this person do X on this page?".
--    Admins (and owners, who are admins) pass everything. Core covers making and checking. Approving is admin-only.
create or replace function has_page_role_for(p_user uuid, p_page uuid, roles page_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and is_org_admin)
      or exists (
        select 1 from (
          select role from page_members where user_id = p_user and page_id = p_page
          union all
          select role from all_page_roles where user_id = p_user
        ) r
        where (r.role = 'viewer' and 'viewer' = any(roles))
           or (r.role = 'core' and roles && array['core','maker','checker','viewer']::page_role[]));
$$;

create or replace function has_page_role(p_page uuid, roles page_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select has_page_role_for(auth.uid(), p_page, roles);
$$;

create or replace function is_member_anywhere() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from page_members where user_id = auth.uid())
      or exists (select 1 from all_page_roles where user_id = auth.uid())
      or exists (select 1 from profiles where id = auth.uid() and is_org_admin);
$$;

-- Reviews: any core member of the page (or an admin) can check a file — just never their own.
create or replace function enforce_review_rules() returns trigger language plpgsql security definer set search_path = public as $$
declare v_submitter uuid; v_page uuid;
begin
  select dv.submitted_by, s.page_id into v_submitter, v_page
  from deliverable_versions dv join deliverables d on d.id = dv.deliverable_id
  join songs s on s.id = d.song_id where dv.id = new.version_id;

  if new.reviewer_id = v_submitter then
    raise exception 'Self-review is not allowed';
  end if;
  if not has_page_role_for(new.reviewer_id, v_page, array['checker']::page_role[]) then
    raise exception 'Only the core team of this page can check files';
  end if;

  if new.decision = 'approve' then
    update deliverable_versions set status = 'approved' where id = new.version_id;
  elsif new.decision = 'request_changes' then
    update deliverable_versions set status = 'changes_requested' where id = new.version_id;
  end if;
  return new;
end $$;

create or replace function enforce_post_approval() returns trigger language plpgsql security definer set search_path = public as $$
declare v_page uuid;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    v_page := post_signoff_page(new.song_id, new.target_page_id);
    if new.approved_by is null or not has_page_role_for(new.approved_by, v_page, array['approver']::page_role[]) then
      raise exception 'Posts are approved by an admin';
    end if;
  end if;
  return new;
end $$;

-- 5) Who can hand out access.
create policy allroles_read  on all_page_roles for select using (is_member_anywhere());
create policy allroles_write on all_page_roles for all
  using (exists (select 1 from profiles where id = auth.uid() and is_org_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_org_admin));
revoke all on all_page_roles from anon;
grant select, insert, update, delete on all_page_roles to authenticated;

-- Only owners make (or unmake) admins; owners themselves always stay admins.
create or replace function set_admin(p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_rights_owner() then raise exception 'Only an owner can change who is an admin'; end if;
  if not p_admin and exists (select 1 from rights_owners where user_id = p_user) then
    raise exception 'Owners are always admins';
  end if;
  update profiles set is_org_admin = p_admin where id = p_user;
end $$;

revoke execute on function set_admin(uuid, boolean), has_page_role_for(uuid, uuid, page_role[]) from public, anon;
grant execute on function set_admin(uuid, boolean), has_page_role_for(uuid, uuid, page_role[]) to authenticated;
revoke execute on function handle_new_user(), enforce_review_rules(), enforce_post_approval() from public, anon, authenticated;
