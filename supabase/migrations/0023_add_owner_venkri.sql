-- Third rights owner (applied 2026-11-12, at the business's request). Owners are always admins.
with v as (select id from profiles where email = 'drvenkri@gmail.com'),
 o as (insert into rights_owners(user_id) select id from v on conflict do nothing),
 a as (update profiles set is_org_admin = true where id in (select id from v))
delete from all_page_roles where user_id in (select id from v);
