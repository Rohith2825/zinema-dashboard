-- Indie page hasn't launched; these releases belong to the Hindi page (applied 2026-11-07).
update songs s set page_id = (select id from pages where slug = 'hindi'),
       code = 'HIN-' || lpad((3 + v.n)::text, 4, '0')
from (values ('FIFA Song', 1), ('Maa I Love You', 2), ('Magic Butterfly', 3)) v(title, n)
where s.title = v.title;
