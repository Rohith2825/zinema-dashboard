-- Rights owners are also org admins. Applied 2026-11-07.
update profiles set is_org_admin = true where lower(email) in ('rohith2825@gmail.com','bsp@xideaz.in');
