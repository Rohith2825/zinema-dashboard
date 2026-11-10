-- The Indie page becomes the Community page (applied 2026-11-10).
-- It had no songs, members or social accounts, so the slug and song-code prefix change with it: COM-0001…
update pages
   set name = 'Zinema.music Community', slug = 'community', code_prefix = 'COM'
 where slug = 'indie';
