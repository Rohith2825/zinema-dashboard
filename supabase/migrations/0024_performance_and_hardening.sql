-- Production hardening from the Supabase performance and security advisors (applied 2026-11-12).

-- 1) Indexes on the foreign keys that pages actually filter and join on.
create index if not exists songs_page_idx                on songs(page_id);
create index if not exists tasks_page_idx                on tasks(page_id);
create index if not exists tasks_song_idx                on tasks(song_id);
create index if not exists tasks_assignee_idx            on tasks(assignee_id);
create index if not exists tasks_deliverable_idx         on tasks(deliverable_id);
create index if not exists comments_song_idx             on comments(song_id);
create index if not exists comments_task_idx             on comments(task_id);
create index if not exists comments_version_idx          on comments(version_id);
create index if not exists activity_song_at_idx          on activity_log(song_id, at desc);
create index if not exists activity_actor_idx            on activity_log(actor_id);
create index if not exists notifications_user_unread_idx on notifications(user_id) where read_at is null;
create index if not exists notifications_user_idx        on notifications(user_id, created_at desc);
create index if not exists notifications_song_idx        on notifications(song_id);
create index if not exists distribution_song_idx         on distribution_records(song_id);
create index if not exists reviews_version_idx           on reviews(version_id);
create index if not exists reviews_reviewer_idx          on reviews(reviewer_id);
create index if not exists versions_submitted_by_idx     on deliverable_versions(submitted_by);
create index if not exists versions_status_idx           on deliverable_versions(status);
create index if not exists audit_runs_version_idx        on audit_runs(version_id);
create index if not exists content_slots_song_idx        on content_slots(song_id);
create index if not exists content_slots_page_idx        on content_slots(page_id);
create index if not exists mentions_user_idx             on mentions(user_id);
create index if not exists deliverables_assignee_idx     on deliverables(assignee_id);
create index if not exists deliverables_checker_idx      on deliverables(checker_id);
create index if not exists song_formats_owner_idx        on song_formats(owner_id);
create index if not exists song_formats_kind_idx         on song_formats(kind);
create index if not exists attendance_office_idx         on attendance(office_id);
create index if not exists posts_song_idx                on posts(song_id);

-- 2) Row-level security: read auth.uid() once per query instead of once per row.
do $$
declare p record; v_using text; v_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ 'auth\.uid\(\)' or coalesce(with_check, '') ~ 'auth\.uid\(\)')
  loop
    v_using := replace(replace(p.qual,       '( SELECT auth.uid() AS uid)', 'auth.uid()'), 'auth.uid()', '(select auth.uid())');
    v_check := replace(replace(p.with_check, '( SELECT auth.uid() AS uid)', 'auth.uid()'), 'auth.uid()', '(select auth.uid())');
    execute format('alter policy %I on %I.%I %s %s', p.policyname, p.schemaname, p.tablename,
      case when v_using is not null then format('using (%s)', v_using) else '' end,
      case when v_check is not null then format('with check (%s)', v_check) else '' end);
  end loop;
end $$;

-- 3) Where a table has a read policy AND an "everything" write policy, both ran on every read.
--    Split the write policy into insert / update / delete so reads check one policy.
do $$
declare p record;
begin
  for p in
    select w.schemaname, w.tablename, w.policyname, w.qual, w.with_check from pg_policies w
     where w.schemaname = 'public' and w.cmd = 'ALL'
       and exists (select 1 from pg_policies r where r.schemaname = w.schemaname and r.tablename = w.tablename and r.cmd = 'SELECT')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format('create policy %I on %I.%I for insert with check (%s)', p.policyname || '_ins', p.schemaname, p.tablename, coalesce(p.with_check, p.qual));
    execute format('create policy %I on %I.%I for update using (%s) with check (%s)', p.policyname || '_upd', p.schemaname, p.tablename, p.qual, coalesce(p.with_check, p.qual));
    execute format('create policy %I on %I.%I for delete using (%s)', p.policyname || '_del', p.schemaname, p.tablename, p.qual);
  end loop;
end $$;

-- 4) Functions: pin the search path, and stop exposing internal helpers through the API.
alter function distance_m(double precision, double precision, double precision, double precision) set search_path = public;
revoke execute on function has_page_role_for(uuid, uuid, page_role[]) from authenticated, anon, public;
revoke execute on function song_page(uuid) from authenticated, anon, public;
revoke execute on function advance_song_stage(uuid, stage_key) from authenticated, anon, public;
drop index if exists songs_ownership_idx;
