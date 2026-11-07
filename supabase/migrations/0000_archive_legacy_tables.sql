-- Applied 2026-11-07 before 0001. The project previously had an older schema
-- (releases, posts, post_comments, profiles). Its rows were copied as JSON into the
-- private `legacy` schema (not exposed over the API), then the old objects were dropped.
create schema if not exists legacy;
revoke all on schema legacy from anon, authenticated;
create table legacy.releases_2026_11      as select to_jsonb(r) as row from public.releases r;
create table legacy.posts_2026_11         as select to_jsonb(p) as row from public.posts p;
create table legacy.post_comments_2026_11 as select to_jsonb(c) as row from public.post_comments c;
create table legacy.profiles_2026_11      as select to_jsonb(p) as row from public.profiles p;

drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.post_comments, public.posts, public.releases, public.profiles cascade;
drop function if exists public.handle_new_user() cascade;
drop type if exists public.distribution_status, public.post_status, public.post_type, public.release_type, public.user_role cascade;
