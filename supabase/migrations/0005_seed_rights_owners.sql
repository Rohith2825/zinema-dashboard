-- Rights owners (can see royalty splits & contract terms; org admins cannot). Applied 2026-11-07.
insert into rights_owners(user_id)
select id from profiles where lower(email) in ('rohith2825@gmail.com','bsp@xideaz.in')
on conflict do nothing;
