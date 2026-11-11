# Zinema OS — System Blueprint (v0.1, brainstorm)

> One system that takes a Zinema Music song from **lyrics → master → distribution (ISRC) → videos → promo posts → live performance**, across five pages, with makers, checkers, approvers, Claude audits, and a full audit trail. People use it from the **web dashboard** or from **Claude** — same data, same rules.

---

## 1. The four pillars (and what each one is *not*)

| Pillar | Role | Is NOT |
|---|---|---|
| **Supabase (Postgres + Auth)** | Single source of truth: people, roles, songs, deliverables, reviews, audits, posts, activity log. All rules (who can approve, stage gates) enforced here via RLS + SQL functions. | Not a file store. No media lives here. |
| **Google Drive (5 TB, Zinema account)** | Every file: lyrics docs, WAVs, stems, artwork, videos, carousels. Folder tree created by the system per song. | Not a database. A Drive link alone means nothing until it is registered as a *deliverable version* in Supabase. |
| **Claude** | Orchestration brain + audit brain. Reads/writes Supabase through the **Zinema MCP bridge**; runs audit skills; writes captions; daily stand-ups. | Not the gatekeeper. Claude *recommends*; a human checker/approver *decides*. Deterministic checks are code, not LLM opinion. |
| **Treg** (publishing + live data) | Posts to Instagram / YouTube / X; pulls metrics, trends, hashtags, SERP for virality + captions. | Not the scheduler. Supabase holds the schedule; Treg executes. |
| **Higgsfield** (the "Xful/Xfield" subscription) | Video creation (lyric/visualizer/vertical generation), **video_analysis** and **virality_predictor** for the video audit. | Not storage. Outputs get copied into the song's Drive folder and registered. |

**Verified today from this session:**
- Treg team `my-team-4558` has exactly **one** `youtube`, **one** `instagram`, **one** `x` connection. → We have **5 pages**; each page needs its own IG/YT connection in Treg (see Open Question #1).
- Treg exposes `instagram.media.container.create` → `instagram.post.publish` and `youtube.video.upload`. Instagram fetches media **from a public URL** — a Drive share link is not reliably a direct-download URL (large videos hit Drive's virus-scan interstitial). See §9 "Media handoff".
- Higgsfield exposes `generate_video`, `video_analysis_create`, `virality_predictor`, `upscale_video`, `reframe` — enough for both generation and the video audit.

---

## 2. Organisation model

```
Organisation: Zinema Music
 ├─ Main brand page: zinema.music (IG) · @ZinemaMusicOfficial (YouTube)   ← connected in Treg today
 └─ Pages (each = its own team, pipeline, approvers, socials)
     ├─ zinema.music.tamil
     ├─ zinema.music.hindi
     ├─ zinema.music.marathi
     ├─ zinema.music.spiritual
     └─ zinema.music.community  (Community page — formerly Indie)
```

- A **song belongs to exactly one home page**. It can have **post targets** on other pages (e.g. a Tamil song also shared on Community). Each target page's approver must approve posts going to *their* page.
- **Roles are per page** (a person can be maker on Tamil and checker on Hindi):

| Role | Can |
|---|---|
| `org_admin` | Everything, all pages, manage pages & people. |
| `page_admin` | Manage members/roles for that page, configure templates & thresholds. |
| `approver` | Final sign-off on stage gates; can override a checker; assigns checkers. |
| `checker` | Review deliverables assigned to them: approve / request changes. **Cannot check their own submission** (DB-enforced). |
| `maker` | Create songs, submit deliverable versions (Drive links), respond to feedback. |
| `viewer` | Read-only (label partners, interns). |

Separation of duties is a constraint, not a convention: `reviews.reviewer_id <> deliverable_versions.submitted_by` checked in SQL.

---

## 3. The song lifecycle (stages + gates)

Each stage has **required deliverables**. A song moves to the next stage only when every required deliverable in the current stage is `approved` (enforced by `advance_song_stage()` in Postgres, so neither the UI nor Claude can skip it).

| # | Stage | Required deliverables (default template) | Claude skill on submit | Gate owner |
|---|---|---|---|---|
| 1 | **Ideation & Lyrics** | `lyrics` (Google Doc), `sound_brief` (refs, mood, tempo, instrumentation notes) | **lyric-virality**: hook strength, wordplay, singability, trend fit, language/dialect check, sensitive-content flags | Page approver |
| 2 | **Music Creation** | `rough_mix` (WAV/MP3), `song_metadata` (title, alt titles, singers, lyricist, composer, producer, genre, mood, language, BPM, key, explicit flag) | — (creative review only) | Checker |
| 3 | **Mix & Master QC** | `master_wav`, `stems` (optional per page), `artwork` (3000×3000) | **mix-audit** (deterministic) + **artwork-audit** | Checker → Approver |
| 4 | **Distribution (PDL Cosmos, manual)** | `distribution_proof`: **ISRC**, **UPC**, **PDL catalog number**, release date, Cosmos status | Format + uniqueness checks; values read from a Cosmos screenshot need a human yes before saving | Approver |
| 5 | **Video** | Format decision: `lyric_video` / `visualizer` / `music_video` (≥1 chosen, per-song) | **video-audit** (tech + visual + virality) | Checker → Approver |
| 6 | **Promo Assets** | **≥3 `carousel`** + **≥3 `vertical`** (mandatory, enforced by count) | **video-audit** / **carousel-audit** | Checker → Target-page approver |
| 7 | **Scheduling & Posting** | `post` records per platform per page with caption + time | **caption-writer** (web search, trending tags, per-platform variants) | Target-page approver |
| 8 | **Live & Learn** | — | **performance-pull**: Treg metrics at 24h / 72h / 7d / 28d back into Supabase | — |

Stages 5–6 can run **in parallel** with 4 once the master is approved (marketing shouldn't wait on PDL). Posting of the *audio-dependent* posts waits on ISRC/release date. The gate model supports this: stages have `depends_on` rather than a strict line.

### Deliverable state machine (same for everything)

```
          submit                assign            approve
 draft ─────────► submitted ───────────► in_review ─────────► approved ──► (locked)
                      ▲                      │
                      │   new version        │ request_changes
                      └──── changes_requested ◄┘
```
- Every resubmission creates a **new version row** (v1, v2, v3…) with its own Drive file. Old versions are never overwritten — the review history stays attached to the exact file reviewed.
- Audits attach to a **version**, not the deliverable. "Approved" always refers to a specific version; the song's "current master" = latest approved `master_wav` version.

---

## 4. Google Drive design

### Folder tree (created automatically when a song is created)
```
Zinema OS/
 └─ {page}/                         e.g. Tamil
     └─ {YYYY}/{song_code} - {title}/      e.g. 2026/TAM-0042 - Kaadhal Mazhai
         ├─ 01_Lyrics/
         ├─ 02_Music/          (rough mixes, refs)
         ├─ 03_Master/         (master WAV, stems, artwork)
         ├─ 04_Distribution/   (PDL screenshots, metadata sheet)
         ├─ 05_Video/          (lyric, visualizer, MV)
         ├─ 06_Promo/
         │    ├─ Carousels/  C1/ C2/ C3/
         │    └─ Verticals/  V1/ V2/ V3/
         ├─ 07_Posted/         (exact files that went live + caption.txt)
         └─ _Audits/           (audit reports as PDFs/MD, written by Claude)
```
- `song_code` = page prefix + sequence (`TAM-0042`, `HIN-0007`, `MAR-…`, `SPI-…`, `COM-…`). Human-friendly, used in chat with Claude ("status of TAM-42?").
- Folder IDs stored on the song / stage rows, so the app deep-links straight into the right folder.

### Link hygiene (the important part)
Users paste a Drive link; the server **does not just store the string**. It:
1. Extracts the file ID, calls Drive API `files.get`.
2. Checks: file exists, is inside *this song's* folder (or moves/copies it there), mime type matches the deliverable (e.g. `audio/wav` for master), size > 0.
3. Stores `drive_file_id`, `mime_type`, `size`, `md5Checksum`, `modifiedTime` on the version row.
4. Rejects if `md5Checksum` changes later on an approved version (someone overwrote an approved file) → raises an alert.

Drive access: one **service account / OAuth app on the Zinema Gmail account** owns the tree; team members get folder-level access per page.

---

## 5. Claude skills (audit + orchestration brain)

Principle: **deterministic numbers from code, judgement from Claude, decision from a human.**

| Skill | Deterministic part (worker code) | Claude part | Output |
|---|---|---|---|
| **mix-audit** | `ffmpeg ebur128` / `ffprobe` / Python: integrated LUFS, LRA, true-peak, sample rate, bit depth, channels, clipping count, DC offset, L/R phase correlation, head/tail silence, duration, mono-compat | Interprets numbers vs page thresholds, plain-English fixes for the mix engineer | `pass / warn / fail` per check + report |
| **artwork-audit** | Pixel size (3000×3000), format, RGB, file size, no transparency | Text/URL/social-handle on cover (DSP rejection risk), legibility at thumbnail size, brand consistency | same |
| **lyric-virality** | Line/syllable counts, repetition density, hook position | Wordplay, hook strength, singability, trend fit (Treg: trending searches/audio per language), cultural & sensitivity flags, 2–3 alternative hook lines | score + suggestions |
| **video-audit** | `ffprobe`: resolution, aspect (9:16 for verticals, 16:9 for YT), fps, bitrate, duration, audio loudness, black/frozen frames | Higgsfield `video_analysis` (scene breakdown) + `virality_predictor` (hook, retention risk); Claude on colour palette, safe-zones (text under IG UI), first-2-second hook, lyric sync/typos | score + timestamped notes |
| **carousel-audit** | Slide count, 1080×1350 / 1080×1080, consistent sizes | Story flow slide 1→N, text readability, brand, CTA | same |
| **caption-writer** | — | Treg web/SERP + social trend search for current hashtags & audio trends per language; writes per-platform captions (IG, YT Shorts title+desc, X), language + transliteration variants; ensures ISRC-correct credits | draft captions → human approves |
| **orchestrator** | SQL views: stuck items, SLA breaches, missing deliverables | Daily stand-up per page: "TAM-42 waiting on checker Priya for 3 days; HIN-07 missing V3" | posted to dashboard + optionally WhatsApp/Email |
| **performance-pull** | Treg YT/IG insights calls on schedule | Weekly "what worked" per page, feeds back into lyric-virality & caption-writer prompts | metrics rows + insight |

Thresholds live in Supabase (`audit_thresholds` per page/deliverable), **not** hard-coded in the skill — so Spiritual can have a different loudness target than a dance track on Community.

> Mix-audit default targets (to confirm with your engineer): WAV 44.1 kHz or 48 kHz, 24-bit, stereo; true-peak ≤ −1.0 dBTP; integrated loudness in a configured window (e.g. −14 to −9 LUFS depending on genre); 0 clipped samples; head silence < 0.5 s; phase correlation > 0.

Where deterministic code runs: a small **audit worker** (Python + ffmpeg in a container, e.g. Cloud Run / Fly / a Supabase-triggered job). It downloads the file from Drive by ID, measures, writes `audit_runs.metrics`. Claude then reads metrics and writes the narrative. Claude never "eyeballs" a loudness number.

---

## 6. The Zinema MCP bridge ("both worlds")

```
 ┌─────────────┐      ┌──────────────────────────────────────┐      ┌──────────┐
 │ Web (Next.js│      │   Next.js app (Vercel)               │      │ Supabase │
 │ dashboards) │─────►│   /app  UI  ──┐                      │      │ Postgres │
 └─────────────┘      │               ├─► domain services ───┼─────►│ + Auth   │
 ┌─────────────┐      │   /api/mcp  ──┘   (one code path)    │      │ + RLS    │
 │ Claude (app,│─────►│   MCP server (Streamable HTTP, OAuth)│      └──────────┘
 │ Code, Cowork)│      └───────────────┬──────────────────────┘
 └─────────────┘                       │ Drive API / Treg / Higgsfield / audit worker
```

- **One domain layer** (`lib/services/*`) used by both the UI and the MCP tools. No logic duplication → "web and Claude can never disagree."
- **Auth:** the MCP server is a remote connector with OAuth; the user logs in with their Supabase account, so **every MCP call runs with that user's RLS**. A checker in Claude sees exactly what they see on the web. Agents/automations use a dedicated `service` identity with scoped permissions and are labelled in the activity log (`actor_type = 'agent'`).
- **MCP tools (first cut):**
  - Read: `whoami`, `list_pages`, `list_songs(page, stage, status)`, `get_song(song_code)` (full card incl. deliverables, versions, reviews, audits, Drive links), `board(page)`, `my_queue()` (things waiting on me), `activity(song_code | since)`, `whats_new(since)`.
  - Write: `create_song`, `submit_version(song_code, deliverable, drive_url, note)`, `assign_checker`, `review(version_id, decision, comments)`, `record_audit(version_id, skill, metrics, verdict, report)`, `set_distribution(song_code, isrc, upc, release_date)`, `advance_stage(song_code)`, `draft_post(...)`, `approve_post`, `schedule_post`.
  - Resources/prompts: `zinema://song/{code}`, prompt templates for each audit skill.
- Writes from Claude obey the same rules: Claude can `record_audit` but **cannot** `review(approve)` unless the human it is acting for is the assigned checker — and even then the UI shows "approved by Priya via Claude".

---

## 7. Data model (summary — full DDL in `supabase/migrations/0001_core.sql`)

```
profiles ─< page_members >─ pages
pages ─< songs ─< song_stages
                 songs ─< deliverables ─< deliverable_versions ─< reviews
                                                       └──────< audit_runs
                 songs ─< distribution_records
                 songs ─< posts ─< post_assets >─ deliverable_versions
                 posts ─< post_metrics
stage_templates / deliverable_templates (per page, configurable: "3 carousels, 3 verticals")
audit_thresholds (per page × deliverable type)
social_accounts (per page × platform → Treg connection name)
activity_log (append-only, every change, actor = user | agent | system)
notifications
```

Key constraints:
- `deliverables.min_count` (carousel ≥3, vertical ≥3) — gate checks count of approved.
- `distribution_records.isrc` — format `^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$`, unique.
- Self-review blocked; only `checker`/`approver` on that page can review; only `approver` can advance a gate.
- `activity_log` has no UPDATE/DELETE grants — tamper-evident trail.

---

## 8. Web app (Next.js): two views + detail

The app is deliberately small: **Kanban** and **Calendar**, plus a song detail drawer and an admin page. Everything else is asked of Claude through the MCP ("what's overdue on Hindi?", "who hasn't checked TAM-42?").

### Kanban
- **Song board:** columns = stages, cards = songs. Each card shows progress chips (`Lyrics ✓ Master ⚠ ISRC – C 2/3 V 0/3`), assignees, days in stage, audit badge.
- **Review board:** columns = `submitted / in review / changes requested / approved`, cards = deliverable versions. Drag a card onto a person to assign a checker.
- **Task board:** columns = `todo / doing / blocked / done`, cards = tasks.
- Filters on every board: page, person ("mine"), song, overdue.

### Calendar (two calendars, one component)
| Calendar | Shows | Source |
|---|---|---|
| **Song release calendar** | Planned release date → actual PDL release date, per page, colour by stage (red if the song isn't through Mix & Master QC 14 days before release) | `songs.planned_release_date`, `distribution_records.release_date` |
| **Content release calendar** | Every carousel / vertical / lyric video / MV, by planned go-live date and page | `content_slots.planned_at` (+ `posts.publish_at` once posting is built) |
| Overlay (toggle) | Task and deliverable due dates | `tasks.due_at`, `deliverables.due_at` |

Drag to reschedule. Release date anchors the content plan: by default the 3 carousels + 3 verticals are spread around the release (e.g. teaser D-7, D-3, release day, D+3, D+7, D+14), editable per song.

### Tasks, tagging and assigning (web and Claude)
- **Tasks:** anyone with a role on the page can create a task, attach it to a song or deliverable (or neither), assign it to a person or leave it unassigned, and set a due date.
- **Tagging:** `@name` in any comment (on a song, deliverable version, review or task) notifies that person and links them to the thread. Tagging is not assigning: a tag is "look at this", a task is "you own this".
- **From Claude:** the same actions are MCP tools: `create_task`, `assign`, `comment` (with @mentions), `my_tasks`, `calendar(range, page, kind)`, `board(page, kind)`. "Assign the 3 verticals for TAM-42 to Ravi, due Friday, and tag Priya to check" works in one sentence.
- Every tag, assignment and date change goes into the activity log with who did it and whether it came from the web or Claude.

### Song detail drawer
Opens from any card or calendar entry: stages, deliverables with version history, Drive previews, audit reports, reviews, comments, tasks, PDL panel.

### Admin
Pages, members and roles, templates, thresholds, Drive root.

Realtime: Supabase Realtime on songs, versions, reviews, tasks and comments, so boards and calendars update live when someone (or Claude) acts.

---

## 9. Posting automation (Treg) — **parked**

> Parked for now (decision 2026-11-07). The content calendar plans the posts; the team posts by hand. The design below is kept for later.

Flow: `post` (draft) → caption-writer drafts → **target-page approver approves caption + assets** → status `scheduled` with `publish_at` → **publisher job** picks due posts → Treg:
- IG carousel: N × `media.container.create` (children) → carousel container → `post.publish`.
- IG Reel/vertical: video container → poll status → publish.
- YouTube: `youtube.video.upload` (Shorts = vertical ≤ 60 s + #Shorts).
- Store returned platform IDs/permalinks on `posts`, copy final files to `07_Posted/`.

**Media handoff problem (must solve in P0 spike):** Instagram's API pulls media from a *publicly reachable direct URL*. Options:
1. Drive "anyone with link" + direct download URL — works for small images, unreliable for videos (virus-scan page). Test first.
2. **Recommended:** a tiny *transient* staging bucket (Supabase Storage or R2), file copied from Drive at publish time, signed URL handed to Treg, **deleted after publish**. Drive stays the only permanent store; staging holds files for minutes.

**Who runs the publisher job?** Decided: Treg can be called directly from our backend. The publisher is a **server cron job** (every 5 min) that reads due posts from Supabase and calls Treg. Claude is only involved for captions and audits, not for pressing "post".

---

## 10. Agents & automation map

| Trigger | Agent | Action |
|---|---|---|
| Version submitted (DB webhook) | Auditor | Run the matching skill → `record_audit` → notify checker |
| Checker assigned | — | Notification (in-app + email/WhatsApp) |
| All required deliverables approved | Orchestrator | Ping approver "TAM-42 ready to advance" |
| Daily 09:30 IST | Orchestrator | Stand-up per page: blocked, overdue, missing promo count |
| Every 15 min | Publisher | Publish due approved posts via Treg |
| Post +24h/+72h/+7d/+28d | Analyst | Pull metrics via Treg → `post_metrics` |
| Weekly | Analyst | "What worked" report per page; updates virality priors |
| Video stage opened | Creator (optional) | Draft verticals/visualizer via Higgsfield from master + artwork → save to Drive → submit as v1 for human checking |

---

## 11. Build roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 — Foundations (1–2 wks)** | Supabase schema + RLS, auth, pages/roles seed, Drive service account + folder generator, Next.js shell. **Spikes:** IG publish from Drive/staging URL; Treg per-page connections; Treg server-side callable? | Create song → Drive tree appears; roles enforced in SQL tests |
| **P1 — Pipeline (2–3 wks)** | Deliverables + versions + Drive link validation, reviews, checker assignment, stage gates, Kanban boards, **song + content calendars, tasks, @tags**, activity log, notifications | A Tamil song can go Lyrics → ISRC on the web with makers/checkers |
| **P2 — MCP bridge (1–2 wks)** | `/api/mcp` with OAuth, read tools then write tools, same services | "What's waiting on me?" and "submit this Drive link as V2 for HIN-07" work from Claude |
| **P3 — Audit brain (2–3 wks)** | Audit worker (ffmpeg), mix/artwork audits, lyric-virality, video-audit with Higgsfield, thresholds UI | Every master/vertical gets an automatic report before a human looks |
| **P4 — Posting (parked)** | Captions, approval, publisher, posted-archive | Approved carousel goes live on the right page at the right time, no human clicks |
| **P5 — Learn loop** | Metrics pull, performance dashboards, weekly insights, Higgsfield-assisted creation | Per-page "what worked" feeding into skills |

Start each phase with **one page (Tamil)** end-to-end, then switch on Hindi/Marathi/Spiritual/Community — they are config, not code.

---

## 12. PDL (Cosmos) integration — manual, no API

PDL has no API. People upload in the Cosmos portal (cosmos.pdlindia.org). What Cosmos shows per release, and what we capture:

| Cosmos field | Example | Our field | Check |
|---|---|---|---|
| Album / title | Digital Mounam | `songs.title` | Must match the song |
| Catalog Number | `00ZM00DM9EB2026` | `distribution_records.catalog_number` | 15 chars, unique |
| UPC | `8909705846185` | `distribution_records.upc` | 12–13 digits, valid check digit, unique |
| ISRC | (shown in Cosmos per track) | `distribution_records.isrc` | `CC-XXX-YY-NNNNN`, unique |
| Sub-label | Zinema Music | `distribution_records.sub_label` | — |
| Language | Tamil / Hindi | `songs.metadata.language` | Must match the song's page |
| Status | e.g. "Waiting for …" / live | `distribution_records.dsp_status` | Updated manually or from a new screenshot |
| Release date | — | `distribution_records.release_date` | Drives when audio-dependent posts can go out |

**Two ways to record it (no export files):**
1. **Web:** the uploader types ISRC, UPC, catalog number and release date into the song's Distribution panel and attaches a Cosmos screenshot.
2. **Screenshot to Claude:** the uploader sends the Cosmos screenshot to Claude ("this is TAM-42 on PDL"). Claude reads title, catalog number, UPC, ISRC, language and status from the image. It shows them back for a yes/no confirmation, then records them through the Zinema MCP (`set_distribution`) and saves the screenshot into `04_Distribution/`. If the title or language on the screenshot doesn't match the song, Claude refuses and asks.

Either way the same format checks run (ISRC pattern, UPC check digit, uniqueness). A row recorded via Claude is marked `source = claude_screenshot`. The approver still passes the gate.

The stage gate needs a valid ISRC + UPC. A release isn't treated as "live" until someone updates the status (web or screenshot) or an approver ticks it.

Note: PDL also offers **Lyricmatic** lyric videos. Count it as an option for the `lyric_video` deliverable (source = PDL) next to Higgsfield and in-house.

## 13. Decisions log

| Date | Question | Decision |
|---|---|---|
| 2026-11-07 | Can the backend call Treg directly? | Yes → the publisher is a server cron job, not a Claude task |
| 2026-11-07 | Does PDL have an API? | No. Manual Cosmos upload; the team enters ISRC/UPC/catalog no. on the website or sends a Cosmos screenshot to Claude. No export-file import |
| 2026-11-07 | Mixing targets | Use the defaults in `docs/MASTERING_SPEC.md` (single master; −14 to −9 LUFS standard, −16 to −12 Spiritual; true peak ≤ −1 / ≤ −2 dBTP) |
| 2026-11-07 | 3 carousels + 3 verticals on Spiritual? | Yes, mandatory on every page |
| 2026-11-07 | Main accounts | IG **zinema.music** (Business, verified via Treg) + YouTube **@ZinemaMusicOfficial** are the main brand page, not one of the 5 language/genre pages |
| 2026-11-07 | Cross-post sign-off | Language page ↔ Indie: **language page's approver**. Main ↔ language page: **main page's approver**. Assumed: Main ↔ Indie → main; two language pages (e.g. Tamil ↔ Hindi) → song's home page; Spiritual counts as a language page. Enforced in the database (`post_signoff_page`) |
| 2026-11-07 | Posting automation | Parked. Team posts by hand for now; social-account, main-page and YouTube-quota questions wait until it's picked up |
| 2026-11-07 | App views | Kanban + Calendar (song release calendar + content release calendar) are enough. Tasks and @tags work on the web and from Claude; everything else via the MCP |
| 2026-11-07 | Sign-in | **Google sign-in only** (Supabase Auth, Google provider). No email/password. Everyone has a Google account, so Drive folders are shared per page to members' Google emails automatically when roles are granted |
| 2026-11-07 | Notifications | **In-app + email only** for now. No WhatsApp/Slack |
| 2026-11-07 | Royalty splits & credits | Stored per song now in `song_rights`, readable/editable **only by rights owners**. Org admins, including the zinema4music account, are **not** owners and can't see them, on the web or via Claude. Owners are seeded once from the list the business gives; after that only an owner can add or remove owners. Contracts live in an owners-only Drive folder (`Zinema OS/_Rights/`), not in song folders. The shared activity log records that rights changed, never the numbers |
| 2026-11-07 | Released catalogue | 21 released songs imported (12 via **DistroKid — legacy, no longer used**, 9 via **PDL — current**). Distributor + legacy flag on each distribution record. Song codes count per page (TAM-0001…) |
| 2026-11-07 | Pages live today | Only **Tamil, Hindi and Spiritual** are active. Marathi and Indie exist in the system but have no songs yet |
| 2026-11-07 | Fifth page | **Zinema.music Indie** (not "India"): its own team, approvers and 3+3 per song, like every other page |
| 2026-11-08 | Formats | A song has many **formats** (vertical, carousel, lyric video, flagship MV, AI MV, visualizer, image-only video, audio-only), each with its own checklist, owner, planned/live dates, Drive folder and live URL — also **after release**. Each format is backed by one deliverable, so file submit/review still works. Every song gets 6 mandatory formats (3 carousels + 3 verticals). Video-kind items are no longer per-page templates; the video gate needs ≥1 approved/live video-stage format. Schema: `supabase/migrations/0014_song_formats.sql` |
| 2026-11-08 | Brand | Black background, white "zinema" wordmark, orange square accent **#fc7c0f**; app icon = white Z on black. Only `/login` is indexable |
| 2026-11-08 | Catalog | `/catalog`: every song as a card (cover art from a Drive link, artist line, page, release date, ISRC, formats). Team fills in cover + artists on the song page. Each format records where it's published (Instagram, YouTube, Shorts, Spotify…, with link + date); the first publication marks the format live. Released songs start with a live "Audio (DSPs)" format. Schema: `0015_catalog_and_publications.sql` |
| 2026-11-10 | Ownership | Every song is labelled **Zinema Original** (made and owned by Zinema) or **Community** (released with Zinema, not owned by it), independent of its page. Used to classify royalty splits. Default Original; all 21 imported songs start as Original. Schema: `0016_song_ownership.sql` |
| 2026-11-10 | Indie → Community | The Indie page is now **Zinema.music Community** (slug `community`, codes `COM-0001…`). Older log rows below that say "Indie" mean this page. Schema: `0017_rename_indie_to_community.sql` |
| 2026-11-11 | MCP server | Live at `/api/mcp` (Streamable HTTP, stateless, hand-rolled JSON-RPC; tools in `src/lib/mcp/tools.ts`). Auth = Supabase's OAuth 2.1 server (consent page `/oauth/consent`, discovery at `/.well-known/oauth-protected-resource`) **or** personal `zos_…` tokens (`mcp_tokens`, hashed; needs `SUPABASE_JWT_SECRET` to mint a short-lived user JWT). Either way calls run under the person's RLS and are logged with `actor_type = 'agent'`. Schema: `0018_mcp_tokens.sql` |
| 2026-11-11 | Google Drive | Drive is the single file store. `src/lib/google-drive.ts` authenticates as a service account (root must be in a shared drive) or as a Google user (refresh token). Folders `Zinema OS / Page / CODE · Title / Stage` are created on first use (`songs.drive_folder_id`). Browser uploads go straight to Drive through a resumable session URL; MCP `save_to_drive` files AI output next to the song |
| 2026-11-11 | UI | Soft "neumorphic" design system (tokens + `.card/.tile/.well/.input/.btn` in `globals.css`), floating dark rail, one-screen board with compact cards and per-stage expand dialog. Public landing page `/` (access & pricing by invitation) and guidebook `/guide`; contact info@zinema.music |
| 2026-11-11 | Spotify | Released songs are enriched from Spotify (artist `5zUwzGZwhIgnPZPNZyHcaw`, market IN), matched on ISRC: cover image, track link, duration, release date, artist line, and a Spotify publication on the Audio format. Team-entered values are never overwritten. Admin button on the catalog and MCP tool `sync_spotify`; code in `src/lib/spotify.ts`. Schema: `0019_spotify.sql` |
| 2026-11-12 | Attendance | Owners add office locations (Maps link → lat/lng, radius default 1 km) and choose who must mark attendance (`attendance_members`). A check-in/out needs a browser location inside an office radius and a selfie stamped with time + coordinates, saved to a private Drive folder (`Zinema OS Attendance (private) / Person / YYYY-MM`, outside the team-shared root) and shown through `/api/attendance/selfie/[id]`. Rows are written only by `mark_attendance()`, which re-checks enrolment and distance. People see their own; owners see the daily register. Schema: `0020_attendance.sql` |

## 14. Open questions (need your call)

1. **PDL upload limits:** bit depth / sample rate / file size / artwork rules from the Cosmos upload form (to lock in as hard fail limits).
2. **Higgsfield role:** audit + occasional generation, or auto-draft verticals for every song?

**Parked with posting:** per-page social accounts, the main page's role, the YouTube upload limit.
