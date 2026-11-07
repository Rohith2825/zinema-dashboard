-- Trigger functions that write to RLS-protected tables run as definer (the caller has no direct write rights there).
alter function notify_task_assignee()  security definer set search_path = public;
alter function notify_mention()        security definer set search_path = public;
alter function enforce_review_rules()  security definer set search_path = public;
-- Pin search_path on the remaining functions.
alter function set_song_code()                    set search_path = public;
alter function stage_gate_ok(uuid, stage_key)     set search_path = public;
alter function seed_mix_thresholds()              set search_path = public;
alter function post_signoff_page(uuid, uuid)      set search_path = public;
alter function enforce_post_approval()            set search_path = public;
alter function check_splits()                     set search_path = public;

-- Everything requires sign-in: anonymous API access gets nothing.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- Profiles for people who had already signed in before this rebuild.
insert into public.profiles (id, full_name, email)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
       u.email
from auth.users u where u.email is not null
on conflict (id) do nothing;

-- First admin.
update public.profiles set is_org_admin = true where email = 'zinema4music@gmail.com';
