-- Zinema OS — auth hook + row-level security for every table.
-- Supabase exposes every public table over its API, so RLS must be ON everywhere.

-- ───────────── New Google sign-in → profile row ─────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Org admins can't be made from the app. Bootstrap once in the SQL editor:
--   update profiles set is_org_admin = true where email = 'zinema4music@gmail.com';

-- ───────────── Helpers ─────────────
create or replace function song_page(p_song uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select page_id from songs where id = p_song;
$$;

create or replace function can_see_song(p_song uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_page_role(song_page(p_song), array['page_admin','approver','checker','maker','viewer']::page_role[]);
$$;

create or replace function can_work_on_song(p_song uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_page_role(song_page(p_song), array['page_admin','approver','checker','maker']::page_role[]);
$$;

create or replace function deliverable_song(p_deliverable uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select song_id from deliverables where id = p_deliverable;
$$;

create or replace function version_song(p_version uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select d.song_id from deliverable_versions v join deliverables d on d.id = v.deliverable_id where v.id = p_version;
$$;

create or replace function is_member_anywhere() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from page_members where user_id = auth.uid())
      or exists (select 1 from profiles where id = auth.uid() and is_org_admin);
$$;

-- ───────────── Enable RLS everywhere ─────────────
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- People & pages: the team directory is visible to every team member (needed for @mentions / assigning).
create policy profiles_read   on profiles for select using (is_member_anywhere() or id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and is_org_admin = (select is_org_admin from profiles where id = auth.uid()));
create policy pages_read      on pages for select using (is_member_anywhere());
create policy members_read    on page_members for select using (is_member_anywhere());
create policy members_write   on page_members for all
  using (has_page_role(page_id, array['page_admin']::page_role[]))
  with check (has_page_role(page_id, array['page_admin']::page_role[]));

-- Page config
create policy social_read  on social_accounts       for select using (has_page_role(page_id, array['page_admin','approver','checker','maker','viewer']::page_role[]));
create policy social_write on social_accounts       for all using (has_page_role(page_id, array['page_admin']::page_role[])) with check (has_page_role(page_id, array['page_admin']::page_role[]));
create policy tmpl_read    on deliverable_templates for select using (has_page_role(page_id, array['page_admin','approver','checker','maker','viewer']::page_role[]));
create policy tmpl_write   on deliverable_templates for all using (has_page_role(page_id, array['page_admin']::page_role[])) with check (has_page_role(page_id, array['page_admin']::page_role[]));
create policy thr_read     on audit_thresholds      for select using (has_page_role(page_id, array['page_admin','approver','checker','maker','viewer']::page_role[]));
create policy thr_write    on audit_thresholds      for all using (has_page_role(page_id, array['page_admin']::page_role[])) with check (has_page_role(page_id, array['page_admin']::page_role[]));

-- Songs (select/insert policies are in 0001)
create policy songs_update on songs for update using (can_work_on_song(id)) with check (can_work_on_song(id));

-- Song-scoped tables: read = anyone on the page; write = non-viewers on the page
create policy stages_read  on song_stages  for select using (can_see_song(song_id));
create policy stages_write on song_stages  for insert with check (can_work_on_song(song_id));
create policy deliv_read   on deliverables for select using (can_see_song(song_id));
create policy deliv_write  on deliverables for all using (can_work_on_song(song_id)) with check (can_work_on_song(song_id));
create policy credits_read  on song_credits for select using (can_see_song(song_id));
create policy credits_write on song_credits for all using (can_work_on_song(song_id)) with check (can_work_on_song(song_id));
create policy dist_read    on distribution_records for select using (can_see_song(song_id));
create policy dist_write   on distribution_records for all using (can_work_on_song(song_id)) with check (can_work_on_song(song_id));
create policy slots_read   on content_slots for select using (can_see_song(song_id));
create policy slots_write  on content_slots for all using (can_work_on_song(song_id)) with check (can_work_on_song(song_id));
create policy posts_read   on posts for select using (can_see_song(song_id));
create policy posts_write  on posts for all using (can_work_on_song(song_id)) with check (can_work_on_song(song_id));

create policy versions_read   on deliverable_versions for select using (can_see_song(deliverable_song(deliverable_id)));
create policy versions_insert on deliverable_versions for insert
  with check (can_work_on_song(deliverable_song(deliverable_id)) and submitted_by = auth.uid());
create policy reviews_read    on reviews for select using (can_see_song(version_song(version_id)));
create policy reviews_insert  on reviews for insert with check (reviewer_id = auth.uid() and can_see_song(version_song(version_id)));  -- role checked by trigger
create policy audits_read     on audit_runs for select using (can_see_song(version_song(version_id)));
create policy audits_insert   on audit_runs for insert with check (can_work_on_song(version_song(version_id)));
create policy passets_read    on post_assets for select using (can_see_song(version_song(version_id)));
create policy pmetrics_read   on post_metrics for select using (exists (select 1 from posts p where p.id = post_id and can_see_song(p.song_id)));

-- Tasks & comments
create policy tasks_read   on tasks for select using (has_page_role(page_id, array['page_admin','approver','checker','maker','viewer']::page_role[]));
create policy tasks_insert on tasks for insert with check (created_by = auth.uid() and has_page_role(page_id, array['page_admin','approver','checker','maker']::page_role[]));
create policy tasks_update on tasks for update using (has_page_role(page_id, array['page_admin','approver','checker','maker']::page_role[]));
create policy comments_read on comments for select using (
  coalesce(can_see_song(song_id), false)
  or exists (select 1 from tasks t where t.id = task_id)
  or coalesce(can_see_song(version_song(version_id)), false));
create policy comments_insert on comments for insert with check (author_id = auth.uid());
create policy mentions_read   on mentions for select using (exists (select 1 from comments c where c.id = comment_id));
create policy mentions_insert on mentions for insert with check (exists (select 1 from comments c where c.id = comment_id and c.author_id = auth.uid()));

-- Notifications: your own only
create policy notif_read   on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update using (user_id = auth.uid());

-- Calendar view respects the RLS of the tables underneath
alter view calendar_events set (security_invoker = true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke update, delete on activity_log from authenticated;
