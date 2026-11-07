-- Released catalogue (applied 2026-11-07). DistroKid is legacy (no longer used); PDL is current.
alter table distribution_records add column legacy boolean not null default false;
alter table distribution_records add constraint distribution_records_distributor_check check (distributor in ('PDL','DistroKid'));
alter table distribution_records drop constraint distribution_records_source_check;
alter table distribution_records add constraint distribution_records_source_check check (source in ('web','claude_screenshot','import'));

create temp table _catalog(title text, page_slug text, language text, distributor text, isrc text) on commit drop;
insert into _catalog values
  ('Vetri Code',               'tamil',     'Tamil',  'DistroKid', 'QZTBF2617241'),
  ('Kaayanaat',                'hindi',     'Hindi',  'DistroKid', 'QZWFE2639821'),
  ('Chutti Payalay',           'tamil',     'Tamil',  'DistroKid', 'QZWFV2699576'),
  ('Ram Ka Shringaar',         'spiritual', 'Hindi',  'DistroKid', 'QZZ762654332'),
  ('Maa I Love You',           'indie',     null,     'DistroKid', 'QZZ7K2646871'),
  ('Manasay Relax',            'tamil',     'Tamil',  'DistroKid', 'QZZ792681494'),
  ('FIFA Song',                'indie',     null,     'DistroKid', 'QT3F62668072'),
  ('Guruvarul Thaatha Thuthi', 'spiritual', 'Tamil',  'DistroKid', 'QT3FE2657618'),
  ('Magic Butterfly',          'indie',     null,     'DistroKid', 'QT6E72679714'),
  ('Angalamman',               'spiritual', 'Tamil',  'DistroKid', 'QT6F92694355'),
  ('Bam Bam Bhole Nath',       'spiritual', 'Hindi',  'DistroKid', 'QT6G52690753'),
  ('Sanjha Chulha',            'hindi',     'Hindi',  'DistroKid', 'QT6G92628665'),
  ('I Found Love',             'hindi',     'Hindi',  'PDL',       'INP2X2501681'),
  ('Digital Mounam',           'tamil',     'Tamil',  'PDL',       'INZ262600001'),
  ('Confusion All Clear',      'tamil',     'Tamil',  'PDL',       'INP2X2501682'),
  ('Shakti Roop',              'spiritual', 'Hindi',  'PDL',       'INP2X2501679'),
  ('Mayai Aru',                'tamil',     'Tamil',  'PDL',       'INP2X2501653'),
  ('Anandha Lakshmi Varahi',   'spiritual', 'Tamil',  'PDL',       'INP2X2501654'),
  ('Hanuman Chalisa',          'spiritual', 'Hindi',  'PDL',       'INP2X2501652'),
  ('Ayyanaar Arul',            'spiritual', 'Tamil',  'PDL',       'INP2X2501650'),
  ('Bappa Ki Jhalak',          'spiritual', 'Hindi',  'PDL',       'INP2X2501604');

insert into songs (page_id, title, current_stage, metadata, created_by)
select p.id, c.title, 'live', jsonb_build_object('language', c.language, 'imported', true, 'released', true),
       (select id from profiles where email = 'zinema4music@gmail.com')
from _catalog c join pages p on p.slug = c.page_slug;

insert into distribution_records (song_id, distributor, legacy, isrc, dsp_status, source, recorded_by)
select s.id, c.distributor, c.distributor = 'DistroKid', c.isrc, 'Released', 'import',
       (select id from profiles where email = 'zinema4music@gmail.com')
from _catalog c join songs s on s.title = c.title;
