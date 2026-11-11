-- Adds the "core" role name (applied 2026-11-12). Used by 0022.
alter type page_role add value if not exists 'core';
