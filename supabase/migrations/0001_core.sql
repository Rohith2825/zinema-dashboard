-- Zinema OS — core schema. Applied to Supabase project ZINEMA DASHBOARD (qdnexjevlnpcydfbioug) on 2026-11-07.
-- Postgres / Supabase. Files live in Google Drive; this DB stores references + workflow state.

create extension if not exists "pgcrypto";

-- ───────────── Enums ─────────────
create type page_role        as enum ('page_admin','approver','checker','maker','viewer');
create type stage_key        as enum ('lyrics','music','master_qc','distribution','video','promo','posting','live');
create type stage_status     as enum ('locked','open','ready_for_gate','approved');
create type deliverable_kind as enum ('lyrics','sound_brief','rough_mix','song_metadata','master_wav','stems','artwork',
                                      'lyric_video','visualizer','music_video','carousel','vertical');
create type version_status   as enum ('submitted','in_review','changes_requested','approved','superseded');
create type review_decision  as enum ('approve','request_changes','comment');
create type audit_verdict    as enum ('pass','warn','fail','error');
create type platform         as enum ('instagram','youtube','x');
create type post_format      as enum ('carousel','reel','short','video','image','text');
create type post_status      as enum ('draft','caption_review','approved','scheduled','publishing','published','failed','cancelled');
create type actor_type       as enum ('user','agent','system');

-- ───────────── People & pages ─────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  is_org_admin boolean not null default false,
  created_at  timestamptz not null default now()
);

create table pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,            -- 'tamil','hindi','marathi','spiritual','indie'
  name        text not null,                   -- 'Zinema.music Tamil'
  code_prefix text not null unique,            -- 'TAM','HIN','MAR','SPI','IND'
  language    text,
  is_main     boolean not null default false,   -- the umbrella brand page (zinema.music / @ZinemaMusicOfficial)
  signoff_rank int not null default 2,          -- cross-post sign-off: lower rank wins. main=1, language pages=2, indie=3
  drive_folder_id text,                        -- Zinema OS/{page}
  created_at  timestamptz not null default now()
);

create table page_members (
  page_id  uuid references pages(id) on delete cascade,
  user_id  uuid references profiles(id) on delete cascade,
  role     page_role not null,
  primary key (page_id, user_id, role)
);

create table social_accounts (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references pages(id) on delete cascade,
  platform      platform not null,
  handle        text not null,
  treg_connection text not null,               -- name of the Treg tool/connection to call
  unique (page_id, platform)
);

-- ───────────── Templates (config, per page) ─────────────
create table deliverable_templates (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references pages(id) on delete cascade,
  stage      stage_key not null,
  kind       deliverable_kind not null,
  required   boolean not null default true,
  min_count  int not null default 1,           -- carousel=3, vertical=3
  allowed_mime text[],                          -- e.g. {'audio/wav','audio/x-wav'}
  audit_skill text,                             -- 'mix-audit','video-audit',...
  unique (page_id, stage, kind)
);

create table audit_thresholds (
  page_id uuid not null references pages(id) on delete cascade,
  kind    deliverable_kind not null,
  rules   jsonb not null,                       -- {"true_peak_max_dbtp":-1.0,"lufs_min":-14,"lufs_max":-9,...}
  primary key (page_id, kind)
);

-- ───────────── Songs ─────────────
create sequence song_seq;
create table songs (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references pages(id),
  code          text not null unique,           -- TAM-0042 (set by trigger)
  title         text not null,
  metadata      jsonb not null default '{}',    -- singers, lyricist, composer, producer, bpm, key, mood, explicit...
  current_stage stage_key not null default 'lyrics',
  planned_release_date date,
  drive_folder_id text,
  owner_id      uuid references profiles(id),
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  archived_at   timestamptz
);

create table song_stages (
  song_id   uuid references songs(id) on delete cascade,
  stage     stage_key not null,
  status    stage_status not null default 'locked',
  drive_folder_id text,
  opened_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  primary key (song_id, stage)
);

create table deliverables (
  id        uuid primary key default gen_random_uuid(),
  song_id   uuid not null references songs(id) on delete cascade,
  stage     stage_key not null,
  kind      deliverable_kind not null,
  slot      int not null default 1,             -- carousel 1..3, vertical 1..3
  required  boolean not null default true,
  assignee_id uuid references profiles(id),     -- maker
  checker_id  uuid references profiles(id),     -- assigned checker
  due_at      timestamptz,
  unique (song_id, kind, slot)
);

create table deliverable_versions (
  id             uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  version        int not null,
  status         version_status not null default 'submitted',
  drive_url      text not null,
  drive_file_id  text not null,
  mime_type      text,
  size_bytes     bigint,
  md5            text,                          -- Drive md5Checksum at submission; detect later overwrites
  note           text,
  submitted_by   uuid not null references profiles(id),
  submitted_via  actor_type not null default 'user',
  submitted_at   timestamptz not null default now(),
  unique (deliverable_id, version)
);

create table reviews (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references deliverable_versions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  decision    review_decision not null,
  comments    text,
  via         actor_type not null default 'user', -- 'agent' when done through Claude on behalf of reviewer
  created_at  timestamptz not null default now()
);

create table audit_runs (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references deliverable_versions(id) on delete cascade,
  skill       text not null,                     -- 'mix-audit@1.0'
  verdict     audit_verdict not null,
  metrics     jsonb not null default '{}',        -- deterministic measurements
  findings    jsonb not null default '[]',        -- [{check, status, value, target, fix}]
  report_md   text,                               -- Claude narrative
  report_drive_file_id text,
  created_at  timestamptz not null default now()
);

create table distribution_records (
  id           uuid primary key default gen_random_uuid(),
  song_id      uuid not null references songs(id) on delete cascade,
  distributor  text not null default 'PDL',
  isrc         text not null unique check (isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
  upc          text check (upc is null or upc ~ '^[0-9]{12,13}$'),
  catalog_number text unique,                 -- PDL Cosmos catalog no., e.g. 00ZM00DM9EB2026
  sub_label    text default 'Zinema Music',
  dsp_status   text,                          -- as shown in Cosmos (e.g. 'Waiting for ...', 'Live')
  source       text not null default 'web' check (source in ('web','claude_screenshot')),
  proof_screenshot_drive_url text,           -- Cosmos screenshot saved in 04_Distribution/
  release_date date,
  proof_drive_url text,
  recorded_by  uuid not null references profiles(id),
  created_at   timestamptz not null default now()
);

-- ───────────── Posting ─────────────
create table posts (
  id           uuid primary key default gen_random_uuid(),
  song_id      uuid not null references songs(id) on delete cascade,
  target_page_id uuid not null references pages(id),   -- may differ from song's home page (cross-post)
  platform     platform not null,
  format       post_format not null,
  status       post_status not null default 'draft',
  caption      text,
  caption_variants jsonb,                              -- AI drafts, hashtags, sources used
  publish_at   timestamptz,
  approved_by  uuid references profiles(id),
  platform_post_id text,
  permalink    text,
  error        text,
  created_at   timestamptz not null default now()
);

create table post_assets (
  post_id    uuid references posts(id) on delete cascade,
  version_id uuid references deliverable_versions(id),
  position   int not null default 1,
  primary key (post_id, position)
);

create table post_metrics (
  post_id   uuid references posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  window_label text not null,                          -- '24h','72h','7d','28d'
  metrics   jsonb not null,                            -- views, likes, saves, shares, watch_time, ...
  primary key (post_id, window_label)
);

-- ───────────── Content plan (drives the content release calendar; posting itself is parked) ─────────────
create table content_slots (
  id            uuid primary key default gen_random_uuid(),
  song_id       uuid not null references songs(id) on delete cascade,
  page_id       uuid not null references pages(id),           -- where it goes live (home page or cross-post target)
  deliverable_id uuid references deliverables(id),             -- which carousel/vertical/video fills this slot
  label         text not null,                                 -- 'Teaser vertical', 'Release-day carousel'
  planned_at    timestamptz not null,
  went_live_at  timestamptz,
  live_url      text,
  created_by    uuid references profiles(id)
);

-- ───────────── Tasks, comments, @mentions ─────────────
create type task_status as enum ('todo','doing','blocked','done');
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references pages(id),
  song_id       uuid references songs(id) on delete cascade,
  deliverable_id uuid references deliverables(id) on delete cascade,
  title         text not null,
  details       text,
  status        task_status not null default 'todo',
  assignee_id   uuid references profiles(id),                  -- null = unassigned
  due_at        timestamptz,
  created_by    uuid not null references profiles(id),
  created_via   actor_type not null default 'user',            -- 'agent' when created from Claude
  created_at    timestamptz not null default now(),
  done_at       timestamptz
);

create table comments (
  id            uuid primary key default gen_random_uuid(),
  song_id       uuid references songs(id) on delete cascade,
  task_id       uuid references tasks(id) on delete cascade,
  version_id    uuid references deliverable_versions(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  via           actor_type not null default 'user',
  body          text not null,
  created_at    timestamptz not null default now(),
  check (num_nonnulls(song_id, task_id, version_id) >= 1)
);

create table mentions (
  comment_id    uuid references comments(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade,
  primary key (comment_id, user_id)
);

-- ───────────── Audit trail & notifications ─────────────
create table activity_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid references profiles(id),
  actor_type actor_type not null default 'user',
  song_id    uuid references songs(id),
  entity     text not null,                            -- table name
  entity_id  uuid,
  action     text not null,                            -- insert/update/submit/approve/...
  diff       jsonb
);

create table notifications (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles(id) on delete cascade,
  song_id   uuid references songs(id) on delete cascade,
  kind      text not null,
  body      text not null,
  read_at   timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────── Calendars (one view, filtered by kind) ─────────────
create view calendar_events as
  select 'song_release'::text kind, s.page_id, s.id song_id, null::uuid ref_id,
         s.code || ' · ' || s.title as title, s.planned_release_date::timestamptz as at, 'planned' as state
    from songs s where s.planned_release_date is not null
  union all
  select 'song_release', s.page_id, s.id, d.id, s.code || ' · ' || s.title, d.release_date::timestamptz, coalesce(d.dsp_status,'released')
    from distribution_records d join songs s on s.id = d.song_id where d.release_date is not null
  union all
  select 'content', c.page_id, c.song_id, c.id, s.code || ' · ' || c.label, coalesce(c.went_live_at, c.planned_at),
         case when c.went_live_at is not null then 'live' else 'planned' end
    from content_slots c join songs s on s.id = c.song_id
  union all
  select 'task_due', t.page_id, t.song_id, t.id, t.title, t.due_at, t.status::text
    from tasks t where t.due_at is not null
  union all
  select 'deliverable_due', s.page_id, s.id, d.id, s.code || ' · ' || d.kind || ' ' || d.slot, d.due_at, 'due'
    from deliverables d join songs s on s.id = d.song_id where d.due_at is not null;

-- Notify on assignment and @mention
create or replace function notify_task_assignee() returns trigger language plpgsql as $$
begin
  if new.assignee_id is not null and new.assignee_id is distinct from coalesce(old.assignee_id, '00000000-0000-0000-0000-000000000000') then
    insert into notifications(user_id, song_id, kind, body) values (new.assignee_id, new.song_id, 'task_assigned', new.title);
  end if;
  return new;
end $$;
create trigger trg_task_notify after insert or update of assignee_id on tasks for each row execute function notify_task_assignee();

create or replace function notify_mention() returns trigger language plpgsql as $$
begin
  insert into notifications(user_id, song_id, kind, body)
  select new.user_id, c.coalesce_song, 'mention', left(c.body, 200)
  from (select coalesce(c.song_id, t.song_id) coalesce_song, c.body from comments c left join tasks t on t.id = c.task_id
        where c.id = new.comment_id) c;
  return new;
end $$;
create trigger trg_mention_notify after insert on mentions for each row execute function notify_mention();

-- ───────────── Helpers ─────────────
create or replace function has_page_role(p_page uuid, roles page_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_org_admin)
      or exists (select 1 from page_members
                 where page_id = p_page and user_id = auth.uid() and role = any(roles));
$$;

-- Song code: TAM-0042
create or replace function set_song_code() returns trigger language plpgsql as $$
begin
  if new.code is null then
    select code_prefix || '-' || lpad(nextval('song_seq')::text, 4, '0') into new.code
    from pages where id = new.page_id;
  end if;
  return new;
end $$;
create trigger trg_song_code before insert on songs for each row execute function set_song_code();

-- Separation of duties: nobody reviews their own submission; only checker/approver of the song's page.
create or replace function enforce_review_rules() returns trigger language plpgsql as $$
declare v_submitter uuid; v_page uuid;
begin
  select dv.submitted_by, s.page_id into v_submitter, v_page
  from deliverable_versions dv join deliverables d on d.id = dv.deliverable_id
  join songs s on s.id = d.song_id where dv.id = new.version_id;

  if new.reviewer_id = v_submitter then
    raise exception 'Self-review is not allowed';
  end if;
  if not exists (select 1 from page_members where page_id = v_page and user_id = new.reviewer_id
                 and role in ('checker','approver'))
     and not exists (select 1 from profiles where id = new.reviewer_id and is_org_admin) then
    raise exception 'Reviewer is not a checker/approver on this page';
  end if;

  if new.decision = 'approve' then
    update deliverable_versions set status = 'approved' where id = new.version_id;
  elsif new.decision = 'request_changes' then
    update deliverable_versions set status = 'changes_requested' where id = new.version_id;
  end if;
  return new;
end $$;
create trigger trg_review_rules before insert on reviews for each row execute function enforce_review_rules();

-- Stage gate: every required deliverable kind in the stage has >= min_count approved slots.
create or replace function stage_gate_ok(p_song uuid, p_stage stage_key) returns boolean
language sql stable as $$
  select not exists (
    select 1 from deliverable_templates t
    join songs s on s.page_id = t.page_id and s.id = p_song
    where t.stage = p_stage and t.required
      and (select count(distinct d.id) from deliverables d
           join deliverable_versions v on v.deliverable_id = d.id and v.status = 'approved'
           where d.song_id = p_song and d.kind = t.kind) < t.min_count
  )
  and (p_stage <> 'distribution' or exists (select 1 from distribution_records where song_id = p_song));
$$;

create or replace function advance_song_stage(p_song uuid, p_stage stage_key) returns void
language plpgsql security definer set search_path = public as $$
declare v_page uuid;
begin
  select page_id into v_page from songs where id = p_song;
  if not has_page_role(v_page, array['approver','page_admin']::page_role[]) then
    raise exception 'Only an approver can pass a stage gate';
  end if;
  if not stage_gate_ok(p_song, p_stage) then
    raise exception 'Gate not met: required deliverables for % are not all approved', p_stage;
  end if;
  update song_stages set status = 'approved', approved_at = now(), approved_by = auth.uid()
   where song_id = p_song and stage = p_stage;
  insert into activity_log(actor_id, song_id, entity, entity_id, action, diff)
  values (auth.uid(), p_song, 'song_stages', p_song, 'gate_approved', jsonb_build_object('stage', p_stage));
end $$;

-- ───────────── RLS (pattern; repeat per table) ─────────────
alter table songs enable row level security;
create policy songs_read  on songs for select using (has_page_role(page_id, array['page_admin','approver','checker','maker','viewer']::page_role[]));
create policy songs_write on songs for insert with check (has_page_role(page_id, array['page_admin','approver','maker']::page_role[]));

alter table activity_log enable row level security;
create policy activity_read on activity_log for select
  using (song_id is null or exists (select 1 from songs s where s.id = song_id));  -- inherits songs RLS
revoke update, delete on activity_log from authenticated, anon;

-- Default mix-audit thresholds (see docs/MASTERING_SPEC.md)
create or replace function seed_mix_thresholds() returns trigger language plpgsql as $$
begin
  insert into audit_thresholds(page_id, kind, rules) values (new.id, 'master_wav',
    case when new.slug = 'spiritual' then
      '{"lufs_pass":[-16,-12],"lufs_warn":[-18,-10],"tp_max_dbtp":-1.0,"tp_max_if_loud_dbtp":-2.0,"loud_above_lufs":-14,
        "lra_min":6,"bit_depth_min":16,"bit_depth_pref":24,"sample_rate_min":44100,"channels":2,
        "clip_runs_warn":1,"clip_runs_fail":4,"phase_warn":0.3,"phase_fail":0,"dc_warn_pct":0.1,"dc_fail_pct":0.5,
        "head_silence_s":[0.5,2],"tail_silence_s":[3,6],"duration_tol_s":1}'::jsonb
    else
      '{"lufs_pass":[-14,-9],"lufs_warn":[-16,-7],"tp_max_dbtp":-1.0,"tp_max_if_loud_dbtp":-2.0,"loud_above_lufs":-14,
        "lra_min":4,"bit_depth_min":16,"bit_depth_pref":24,"sample_rate_min":44100,"channels":2,
        "clip_runs_warn":1,"clip_runs_fail":4,"phase_warn":0.3,"phase_fail":0,"dc_warn_pct":0.1,"dc_fail_pct":0.5,
        "head_silence_s":[0.5,2],"tail_silence_s":[3,6],"duration_tol_s":1}'::jsonb
    end)
  on conflict do nothing;
  return new;
end $$;
create trigger trg_seed_thresholds after insert on pages for each row execute function seed_mix_thresholds();

-- Cross-post sign-off: the page with the LOWER signoff_rank approves.
--   language x indie  -> language page approves
--   main x language   -> main page approves
--   main x indie      -> main page approves (assumed)
--   same rank (e.g. Tamil x Hindi) -> the song's home page approves (assumed)
create or replace function post_signoff_page(p_song uuid, p_target uuid) returns uuid
language sql stable as $$
  select case when t.signoff_rank < h.signoff_rank then t.id else h.id end
  from songs s join pages h on h.id = s.page_id, pages t
  where s.id = p_song and t.id = p_target;
$$;

create or replace function enforce_post_approval() returns trigger language plpgsql as $$
declare v_page uuid;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    v_page := post_signoff_page(new.song_id, new.target_page_id);
    if new.approved_by is null or not (
         exists (select 1 from page_members where page_id = v_page and user_id = new.approved_by
                 and role in ('approver','page_admin'))
      or exists (select 1 from profiles where id = new.approved_by and is_org_admin)) then
      raise exception 'Post must be approved by an approver of page %', (select name from pages where id = v_page);
    end if;
  end if;
  return new;
end $$;
create trigger trg_post_approval before update on posts for each row execute function enforce_post_approval();

-- Seed pages
insert into pages (slug, name, code_prefix, language) values
  ('tamil','Zinema.music Tamil','TAM','ta'),
  ('hindi','Zinema.music Hindi','HIN','hi'),
  ('marathi','Zinema.music Marathi','MAR','mr'),
  ('spiritual','Zinema.music Spiritual','SPI',null),
  ('indie','Zinema.music Indie','IND',null);
update pages set signoff_rank = 3 where slug = 'indie';
insert into pages (slug, name, code_prefix, language, is_main) values
  ('main','Zinema.music','ZIN',null,true);
update pages set signoff_rank = 1 where slug = 'main';

-- Verified 2026-11-07 via Treg: IG business account 'zinema.music' (id 28896131403390581).
insert into social_accounts (page_id, platform, handle, treg_connection)
select id, 'instagram'::platform, 'zinema.music', 'instagram' from pages where slug = 'main' union all
select id, 'youtube'::platform, '@ZinemaMusicOfficial', 'youtube' from pages where slug = 'main' union all
select id, 'x'::platform, 'TBD', 'x' from pages where slug = 'main';

-- ═════════════ Song credits — PUBLIC to everyone on the page ═════════════
-- The names that appear on the release / lyrics (singer, lyricist, composer, producer, mix engineer…).
create table song_credits (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references songs(id) on delete cascade,
  role        text not null,                 -- 'singer','lyricist','composer','music_producer','mix_engineer','mastering_engineer',...
  name        text not null,
  as_credited text,                          -- exact spelling for DSPs / PDL
  position    int not null default 1,
  unique (song_id, role, name)
);

-- ═════════════ Royalty splits & contract terms — OWNERS ONLY ═════════════
-- Org admins (incl. the zinema4music account) are NOT owners and cannot read these rows.
-- Owners are seeded once at deploy time from the list the business provides; after that,
-- only an existing owner can add or remove owners. Admins cannot grant ownership (not even to themselves).

create table rights_owners (
  user_id    uuid primary key references profiles(id) on delete cascade,
  granted_by uuid references profiles(id),          -- null = seeded at deploy
  granted_at timestamptz not null default now()
);

create table song_rights (
  song_id    uuid primary key references songs(id) on delete cascade,
  splits     jsonb not null default '[]',
  -- [{"party":"…","role":"lyricist|composer|producer|singer|label|publisher","share_pct":25.0,
  --   "type":"publishing|master","ipi":"…","notes":"…"}]
  contract_terms jsonb not null default '{}',        -- advances, term, territory, recoupment… (owner-only)
  contract_drive_url text,                            -- in the owners-only Drive folder, never the song folder
  notes      text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create or replace function is_rights_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rights_owners where user_id = auth.uid());
$$;

-- Shares must add up to 100 % per split type (publishing, master).
create or replace function check_splits() returns trigger language plpgsql as $$
declare bad text;
begin
  select string_agg(t || '=' || total, ', ') into bad from (
    select coalesce(x->>'type','master') t, sum((x->>'share_pct')::numeric) total
    from jsonb_array_elements(new.splits) x group by 1) s
  where total <> 100;
  if bad is not null then raise exception 'Split shares must total 100%% per type (got %)', bad; end if;
  new.updated_at := now(); new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
create trigger trg_check_splits before insert or update on song_rights for each row execute function check_splits();

alter table rights_owners enable row level security;
alter table song_rights  enable row level security;
create policy rights_owner_all on song_rights   for all using (is_rights_owner()) with check (is_rights_owner());
create policy owners_read      on rights_owners for select using (is_rights_owner());
create policy owners_manage    on rights_owners for insert with check (is_rights_owner() and granted_by = auth.uid());
create policy owners_remove    on rights_owners for delete using (is_rights_owner() and user_id <> auth.uid());
grant select, insert, update, delete on song_rights, rights_owners to authenticated;

-- The shared activity log only records THAT rights changed and by whom — never the numbers.
create or replace function log_rights_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into activity_log(actor_id, song_id, entity, entity_id, action)
  values (auth.uid(), coalesce(new.song_id, old.song_id), 'song_rights', coalesce(new.song_id, old.song_id), lower(tg_op));
  return coalesce(new, old);
end $$;
create trigger trg_log_rights after insert or update or delete on song_rights for each row execute function log_rights_change();

-- Seed owners at deploy (fill in the owner Google emails; they must have signed in once):
-- insert into rights_owners(user_id) select id from profiles where email in ('owner1@…','owner2@…');
