-- Languages for the three Indie releases (applied 2026-11-07).
update songs set metadata = metadata || '{"language":"Hindi"}'::jsonb
 where title in ('FIFA Song','Maa I Love You','Magic Butterfly');
update songs set metadata = metadata || '{"style":"International fusion (mainly Hindi, some Tamil)"}'::jsonb
 where title = 'FIFA Song';
