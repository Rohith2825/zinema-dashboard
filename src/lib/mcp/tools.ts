import "server-only";
import { parseDriveId } from "@/lib/drive";
import { DriveError, driveConfigured, ensureFolder, ensureSongFolder, folderUrl, getFile, listFolder, uploadBytes } from "@/lib/google-drive";
import { SITE_URL } from "@/lib/site";
import { spotifyConfigured, syncSpotify } from "@/lib/spotify";
import { FORMAT_PLATFORMS, KIND_LABEL, PLATFORM_LABEL, STAGES } from "@/lib/types";
import type { McpAuth } from "./auth";

/**
 * Zinema OS MCP tools. Every tool runs as the signed-in person through Supabase row-level security,
 * so an AI client can do exactly what that person can do on the website — no more.
 */

export class ToolError extends Error {}
type Args = Record<string, unknown>;
type Schema = { type: "object"; properties: Record<string, object>; required?: string[] };
export type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Schema;
  readOnly?: boolean;
  run: (ctx: McpAuth, args: Args) => Promise<unknown>;
};

const s = (description: string, extra: object = {}) => ({ type: "string", description, ...extra });
const CODE = s("Song code, e.g. TAM-0007");
const DATE = (what: string) => s(`${what} as YYYY-MM-DD (India time)`);
const str = (a: Args, k: string) => (typeof a[k] === "string" && (a[k] as string).trim() !== "" ? (a[k] as string).trim() : undefined);
const need = (a: Args, k: string) => {
  const v = str(a, k);
  if (!v) throw new ToolError(`"${k}" is required.`);
  return v;
};
const ist = (d: string) => new Date(`${d}T18:00:00+05:30`).toISOString();
const songUrl = (code: string) => `${SITE_URL}/songs/${code}`;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) {
    const m = res.error.message;
    throw new ToolError(m.includes("row-level security") ? "You don't have permission to do that on this page." : m);
  }
  return res.data;
}

async function songByCode(ctx: McpAuth, code: string) {
  const data = check(
    await ctx.supabase
      .from("songs")
      .select("id, code, title, page_id, current_stage, ownership, artists, planned_release_date, drive_folder_id, spotify_url, cover_image_url, duration_ms, metadata")
      .eq("code", code.toUpperCase())
      .maybeSingle(),
  );
  if (!data) throw new ToolError(`No song with code ${code.toUpperCase()} (or you can't see it).`);
  return data;
}

async function pageBy(ctx: McpAuth, ref: string) {
  const pages = check(await ctx.supabase.from("pages").select("id, slug, name, code_prefix"));
  const r = ref.toLowerCase();
  const page = pages?.find((p) => p.slug === r || p.code_prefix.toLowerCase() === r || p.name.toLowerCase().endsWith(r));
  if (!page) throw new ToolError(`Unknown page "${ref}". Use one of: ${pages?.map((p) => p.slug).join(", ")}.`);
  return page;
}

async function personByEmail(ctx: McpAuth, email: string) {
  const data = check(await ctx.supabase.from("profiles").select("id, full_name, email").ilike("email", email).maybeSingle());
  if (!data) throw new ToolError(`Nobody on the team has the email ${email}. They need to sign in to Zinema OS once first.`);
  return data;
}

async function formatById(ctx: McpAuth, id: string) {
  const data = check(await ctx.supabase.from("song_formats").select("id, song_id, kind, label, status, deliverable_id").eq("id", id).maybeSingle());
  if (!data) throw new ToolError("Format not found. Use get_song to see a song's formats and their ids.");
  return data;
}

export const TOOLS: Tool[] = [
  // ───────────── Read ─────────────
  {
    name: "whoami",
    title: "Who am I",
    description: "The signed-in person, their roles on each page, and whether Google Drive is connected. Call this first.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    async run(ctx) {
      const [profile, roles, all, owner] = await Promise.all([
        ctx.supabase.from("profiles").select("full_name, nickname, handle, email, is_org_admin").eq("id", ctx.userId).maybeSingle(),
        ctx.supabase.from("page_members").select("role, page:pages(slug, name)").eq("user_id", ctx.userId),
        ctx.supabase.from("all_page_roles").select("role").eq("user_id", ctx.userId).maybeSingle(),
        ctx.supabase.rpc("is_rights_owner"),
      ]);
      return {
        ...check(profile),
        rights_owner: owner.data === true,
        roles: check(roles),
        all_pages_role: all.data?.role ?? null,
        access_note: "owner/admin: everything incl. approving stages; core: make and check, cannot approve; viewer: read-only",
        drive_connected: driveConfigured(),
        dashboard: SITE_URL,
        stages: STAGES.map((x) => x.key),
      };
    },
  },
  {
    name: "list_pages",
    title: "List pages",
    description: "Zinema pages (Tamil, Hindi, Marathi, Spiritual, Community, Main) with song counts.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    async run(ctx) {
      const pages = check(await ctx.supabase.from("pages").select("slug, name, code_prefix, is_main, songs(count)").order("signoff_rank"));
      return pages;
    },
  },
  {
    name: "list_songs",
    title: "List songs",
    description: "Songs on the board / in the catalog. Filter by page, stage, ownership (original = Zinema Original, community) or a search word.",
    inputSchema: {
      type: "object",
      properties: {
        page: s("Page slug or prefix, e.g. tamil or TAM"),
        stage: s("Pipeline stage", { enum: STAGES.map((x) => x.key) }),
        ownership: s("original or community", { enum: ["original", "community"] }),
        query: s("Matches title, code or artists"),
      },
    },
    readOnly: true,
    async run(ctx, a) {
      let q = ctx.supabase
        .from("songs")
        .select("code, title, artists, ownership, current_stage, planned_release_date, page:pages(slug), distribution_records(isrc, release_date, distributor), song_formats(kind, status)")
        .is("archived_at", null)
        .order("code");
      if (str(a, "page")) q = q.eq("page_id", (await pageBy(ctx, str(a, "page")!)).id);
      if (str(a, "stage")) q = q.eq("current_stage", str(a, "stage")!);
      if (str(a, "ownership")) q = q.eq("ownership", str(a, "ownership")!);
      const term = str(a, "query")?.replace(/[%,()]/g, "");
      if (term) q = q.or(`title.ilike.%${term}%,code.ilike.%${term}%,artists.ilike.%${term}%`);
      return check(await q);
    },
  },
  {
    name: "get_song",
    title: "Get a song",
    description:
      "Everything about one song: stage, files and their review status, formats with checklists and where they're published, distribution (ISRC/UPC), credits, tasks, comments and the Drive folder.",
    inputSchema: { type: "object", properties: { code: CODE }, required: ["code"] },
    readOnly: true,
    async run(ctx, a) {
      const song = await songByCode(ctx, need(a, "code"));
      const [deliverables, formats, dist, credits, tasks, comments] = await Promise.all([
        ctx.supabase
          .from("deliverables")
          .select("id, stage, kind, slot, required, due_at, deliverable_versions(id, version, status, drive_url, note, submitted_at, reviews(decision, comments, created_at))")
          .eq("song_id", song.id),
        ctx.supabase
          .from("song_formats")
          .select("id, kind, label, status, mandatory, planned_at, went_live_at, live_url, drive_folder_url, notes, format_checklist(id, label, position, done_at), format_publications(platform, url, published_at)")
          .eq("song_id", song.id),
        ctx.supabase.from("distribution_records").select("distributor, legacy, isrc, upc, catalog_number, release_date, dsp_status").eq("song_id", song.id),
        ctx.supabase.from("song_credits").select("role, name").eq("song_id", song.id),
        ctx.supabase.from("tasks").select("id, title, status, due_at, assignee:profiles!tasks_assignee_id_fkey(email)").eq("song_id", song.id),
        ctx.supabase.from("comments").select("body, created_at, via, author:profiles!comments_author_id_fkey(full_name)").eq("song_id", song.id).order("created_at"),
      ]);
      return {
        ...song,
        url: songUrl(song.code),
        drive_folder: song.drive_folder_id ? folderUrl(song.drive_folder_id) : null,
        deliverables: check(deliverables),
        formats: check(formats),
        distribution: check(dist),
        credits: check(credits),
        tasks: tasks.data ?? [],
        comments: comments.data ?? [],
      };
    },
  },
  {
    name: "my_queue",
    title: "My queue",
    description: "What's waiting on me: files to check, my submissions that need changes, my open tasks and unread notifications.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    async run(ctx) {
      const [toCheck, changes, tasks, notes] = await Promise.all([
        ctx.supabase
          .from("deliverable_versions")
          .select("id, version, submitted_at, drive_url, deliverable:deliverables(kind, slot, song:songs(code, title))")
          .eq("status", "submitted")
          .neq("submitted_by", ctx.userId),
        ctx.supabase
          .from("deliverable_versions")
          .select("id, version, deliverable:deliverables(kind, slot, song:songs(code, title)), reviews(comments, created_at)")
          .eq("status", "changes_requested")
          .eq("submitted_by", ctx.userId),
        ctx.supabase.from("tasks").select("id, title, status, due_at, song:songs(code)").eq("assignee_id", ctx.userId).neq("status", "done"),
        ctx.supabase.from("notifications").select("kind, body, created_at").is("read_at", null).order("created_at", { ascending: false }).limit(20),
      ]);
      return { files_to_check: toCheck.data ?? [], changes_requested: changes.data ?? [], my_tasks: tasks.data ?? [], unread: notes.data ?? [] };
    },
  },
  {
    name: "calendar",
    title: "Calendar",
    description: "Song releases, format go-live dates, content slots and due dates between two dates.",
    inputSchema: {
      type: "object",
      properties: { from: DATE("Start"), to: DATE("End"), page: s("Page slug (optional)"), kind: s("song_release, format, content, task_due or deliverable_due") },
      required: ["from", "to"],
    },
    readOnly: true,
    async run(ctx, a) {
      let q = ctx.supabase
        .from("calendar_events")
        .select("kind, title, at, state, song_id")
        .gte("at", new Date(`${need(a, "from")}T00:00:00+05:30`).toISOString())
        .lte("at", new Date(`${need(a, "to")}T23:59:59+05:30`).toISOString())
        .order("at");
      if (str(a, "page")) q = q.eq("page_id", (await pageBy(ctx, str(a, "page")!)).id);
      if (str(a, "kind")) q = q.eq("kind", str(a, "kind")!);
      return check(await q);
    },
  },
  {
    name: "activity",
    title: "Activity",
    description: "Recent activity (who did what), for one song or across everything I can see.",
    inputSchema: { type: "object", properties: { code: CODE, limit: { type: "number", description: "How many rows (default 30, max 100)" } } },
    readOnly: true,
    async run(ctx, a) {
      let q = ctx.supabase
        .from("activity_log")
        .select("at, actor_type, entity, action, diff, actor:profiles(full_name), song:songs(code)")
        .order("at", { ascending: false })
        .limit(Math.min(Number(a.limit) || 30, 100));
      if (str(a, "code")) q = q.eq("song_id", (await songByCode(ctx, str(a, "code")!)).id);
      return check(await q);
    },
  },
  {
    name: "list_team",
    title: "List team",
    description: "People on the team with their page roles (for assigning tasks, owners and checkers by email).",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    async run(ctx) {
      return check(await ctx.supabase.from("profiles").select("full_name, nickname, handle, bio, email, is_org_admin, page_members(role, page:pages(slug)), all_page_roles!all_page_roles_user_id_fkey(role)").order("full_name"));
    },
  },
  {
    name: "list_tasks",
    title: "List tasks",
    description: "Tasks, optionally only mine, only one page, or one status.",
    inputSchema: {
      type: "object",
      properties: { mine: { type: "boolean", description: "Only tasks assigned to me" }, page: s("Page slug"), status: s("todo, doing, blocked or done") },
    },
    readOnly: true,
    async run(ctx, a) {
      let q = ctx.supabase.from("tasks").select("id, title, details, status, due_at, song:songs(code), assignee:profiles!tasks_assignee_id_fkey(email)").order("due_at", { nullsFirst: false });
      if (a.mine === true) q = q.eq("assignee_id", ctx.userId);
      if (str(a, "page")) q = q.eq("page_id", (await pageBy(ctx, str(a, "page")!)).id);
      if (str(a, "status")) q = q.eq("status", str(a, "status")!);
      return check(await q);
    },
  },

  // ───────────── Songs ─────────────
  {
    name: "create_song",
    title: "Create a song",
    description: "Starts a new song on a page. Creates its stages, required files and the 6 mandatory formats (3 carousels + 3 verticals).",
    inputSchema: {
      type: "object",
      properties: {
        title: s("Song title"),
        page: s("Page slug or prefix, e.g. tamil"),
        ownership: s("original (made and owned by Zinema) or community", { enum: ["original", "community"] }),
        language: s("Language"),
        artists: s("Artist line, e.g. 'Sid Sriram, Shreya Ghoshal'"),
        planned_release_date: DATE("Planned release"),
      },
      required: ["title", "page"],
    },
    async run(ctx, a) {
      const page = await pageBy(ctx, need(a, "page"));
      const song = check(
        await ctx.supabase
          .from("songs")
          .insert({
            title: need(a, "title"),
            page_id: page.id,
            ownership: str(a, "ownership") === "community" ? "community" : "original",
            artists: str(a, "artists") ?? null,
            planned_release_date: str(a, "planned_release_date") ?? null,
            metadata: { language: str(a, "language") ?? null },
            created_by: ctx.userId,
            owner_id: ctx.userId,
          })
          .select("code, title, current_stage")
          .single(),
      );
      if (!song) throw new ToolError("The song wasn't created.");
      return { ...song, url: songUrl(song.code) };
    },
  },
  {
    name: "update_song",
    title: "Update a song",
    description: "Change a song's title, artists, cover art (Drive link), language, planned release date or ownership.",
    inputSchema: {
      type: "object",
      properties: {
        code: CODE,
        title: s("New title"),
        artists: s("Artist line"),
        cover_url: s("Google Drive link to the cover art"),
        language: s("Language"),
        planned_release_date: DATE("Planned release"),
        ownership: s("original or community", { enum: ["original", "community"] }),
      },
      required: ["code"],
    },
    async run(ctx, a) {
      const song = await songByCode(ctx, need(a, "code"));
      const patch: Record<string, unknown> = {};
      for (const k of ["title", "artists", "planned_release_date", "ownership"] as const) if (str(a, k)) patch[k] = str(a, k);
      if (str(a, "cover_url")) {
        if (!parseDriveId(str(a, "cover_url")!)) throw new ToolError("cover_url must be a Google Drive link.");
        patch.cover_url = str(a, "cover_url");
      }
      if (str(a, "language")) patch.metadata = { ...((song.metadata as object) ?? {}), language: str(a, "language") };
      if (!Object.keys(patch).length) throw new ToolError("Nothing to change.");
      check(await ctx.supabase.from("songs").update(patch).eq("id", song.id));
      return { ok: true, code: song.code, changed: Object.keys(patch), url: songUrl(song.code) };
    },
  },
  {
    name: "advance_song",
    title: "Move a song to the next stage",
    description: "Admins and owners only. Moves the song forward if every required item of its current stage is approved (the stage gate).",
    inputSchema: { type: "object", properties: { code: CODE }, required: ["code"] },
    async run(ctx, a) {
      const song = await songByCode(ctx, need(a, "code"));
      const next = check(await ctx.supabase.rpc("advance_song", { p_song: song.id }));
      return { ok: true, code: song.code, from: song.current_stage, to: next };
    },
  },
  {
    name: "record_distribution",
    title: "Record distribution",
    description: "Record the PDL (Cosmos) upload for a song: ISRC, UPC, catalog number, release date and status.",
    inputSchema: {
      type: "object",
      properties: {
        code: CODE,
        isrc: s("ISRC, 12 characters, e.g. INP2X2501681"),
        upc: s("UPC, 12–13 digits"),
        catalog_number: s("Catalog number"),
        release_date: DATE("Release date"),
        dsp_status: s("Status shown in Cosmos"),
        distributor: s("Defaults to PDL"),
      },
      required: ["code", "isrc"],
    },
    async run(ctx, a) {
      const song = await songByCode(ctx, need(a, "code"));
      const distributor = str(a, "distributor") ?? "PDL";
      check(
        await ctx.supabase.from("distribution_records").insert({
          song_id: song.id,
          distributor,
          legacy: distributor === "DistroKid",
          isrc: need(a, "isrc").replace(/[-\s]/g, "").toUpperCase(),
          upc: str(a, "upc")?.replace(/\s/g, "") ?? null,
          catalog_number: str(a, "catalog_number")?.toUpperCase() ?? null,
          release_date: str(a, "release_date") ?? null,
          dsp_status: str(a, "dsp_status") ?? null,
          recorded_by: ctx.userId,
        }),
      );
      return { ok: true, code: song.code };
    },
  },
  {
    name: "add_credit",
    title: "Add a credit",
    description: "Add a credit to a song (Singer, Lyricist, Composer, Music producer, Mix engineer, Mastering engineer, Featuring…).",
    inputSchema: { type: "object", properties: { code: CODE, role: s("Role"), name: s("Person's name") }, required: ["code", "role", "name"] },
    async run(ctx, a) {
      const song = await songByCode(ctx, need(a, "code"));
      check(await ctx.supabase.from("song_credits").insert({ song_id: song.id, role: need(a, "role"), name: need(a, "name") }));
      return { ok: true };
    },
  },

  // ───────────── Files & reviews ─────────────
  {
    name: "submit_file",
    title: "Submit a file for checking",
    description:
      "Submit a Google Drive link as a new version of a deliverable (lyrics, sound_brief, rough_mix, song_metadata, master_wav, stems, artwork) or of a format (pass format_id). It goes to a checker; nobody can approve their own submission.",
    inputSchema: {
      type: "object",
      properties: {
        code: CODE,
        kind: s("Deliverable kind", { enum: Object.keys(KIND_LABEL) }),
        slot: { type: "number", description: "Slot number for carousels/verticals (1–3). Default 1." },
        format_id: s("Format id from get_song (instead of kind/slot)"),
        drive_url: s("Google Drive / Docs link to the file"),
        note: s("Note for the checker"),
      },
      required: ["code", "drive_url"],
    },
    async run(ctx, a) {
      const song = await songByCode(ctx, need(a, "code"));
      const url = need(a, "drive_url");
      const fileId = parseDriveId(url);
      if (!fileId) throw new ToolError("drive_url must be a Google Drive or Docs link.");
      let deliverableId: string | null = null;
      if (str(a, "format_id")) deliverableId = (await formatById(ctx, str(a, "format_id")!)).deliverable_id;
      else {
        const d = check(
          await ctx.supabase.from("deliverables").select("id").eq("song_id", song.id).eq("kind", need(a, "kind")).eq("slot", Number(a.slot) || 1).maybeSingle(),
        );
        deliverableId = d?.id ?? null;
      }
      if (!deliverableId) throw new ToolError("That item doesn't exist on this song. Use get_song to see its deliverables and formats.");
      const v = check(
        await ctx.supabase
          .from("deliverable_versions")
          .insert({ deliverable_id: deliverableId, drive_url: url, drive_file_id: fileId, note: str(a, "note") ?? null, submitted_by: ctx.userId, submitted_via: "agent" })
          .select("id, version, status")
          .single(),
      );
      return { ok: true, ...v, url: songUrl(song.code) };
    },
  },
  {
    name: "review_file",
    title: "Review a submitted file",
    description: "Core team or admin: approve a submitted version or request changes (comments required). You can't review your own submission.",
    inputSchema: {
      type: "object",
      properties: { version_id: s("Version id from get_song or my_queue"), decision: s("approve or request_changes", { enum: ["approve", "request_changes"] }), comments: s("Feedback") },
      required: ["version_id", "decision"],
    },
    async run(ctx, a) {
      const decision = need(a, "decision");
      if (decision === "request_changes" && !str(a, "comments")) throw new ToolError("Say what needs to change.");
      check(await ctx.supabase.from("reviews").insert({ version_id: need(a, "version_id"), reviewer_id: ctx.userId, decision, comments: str(a, "comments") ?? null }));
      return { ok: true, decision };
    },
  },

  // ───────────── Formats ─────────────
  {
    name: "add_format",
    title: "Add a format",
    description: `Add a format to a song at any point, including after release. Kinds: ${Object.keys(FORMAT_PLATFORMS).join(", ")}. It comes with a default checklist.`,
    inputSchema: {
      type: "object",
      properties: { code: CODE, kind: s("Format kind", { enum: Object.keys(FORMAT_PLATFORMS) }), label: s("Name, e.g. 'Dance vertical'") },
      required: ["code", "kind"],
    },
    async run(ctx, a) {
      const song = await songByCode(ctx, need(a, "code"));
      const id = check(await ctx.supabase.rpc("add_song_format", { p_song: song.id, p_kind: need(a, "kind"), p_label: str(a, "label") ?? null }));
      return { ok: true, format_id: id, url: songUrl(song.code) };
    },
  },
  {
    name: "update_format",
    title: "Update a format",
    description: "Change a format's status (planned, in_progress, in_review, approved, live, dropped), owner, planned date, notes, name or Drive folder.",
    inputSchema: {
      type: "object",
      properties: {
        format_id: s("Format id from get_song"),
        status: s("New status", { enum: ["planned", "in_progress", "in_review", "approved", "live", "dropped"] }),
        owner_email: s("Email of the person responsible"),
        planned_at: DATE("Planned for"),
        label: s("New name"),
        notes: s("Notes"),
        drive_folder_url: s("Google Drive folder link"),
      },
      required: ["format_id"],
    },
    async run(ctx, a) {
      const f = await formatById(ctx, need(a, "format_id"));
      const patch: Record<string, unknown> = {};
      for (const k of ["status", "label", "notes", "drive_folder_url"] as const) if (str(a, k)) patch[k] = str(a, k);
      if (str(a, "planned_at")) patch.planned_at = ist(str(a, "planned_at")!);
      if (str(a, "owner_email")) patch.owner_id = (await personByEmail(ctx, str(a, "owner_email")!)).id;
      if (patch.status === "live") patch.went_live_at = new Date().toISOString();
      if (!Object.keys(patch).length) throw new ToolError("Nothing to change.");
      check(await ctx.supabase.from("song_formats").update(patch).eq("id", f.id));
      return { ok: true, format: f.label, changed: Object.keys(patch) };
    },
  },
  {
    name: "tick_checklist",
    title: "Tick a checklist item",
    description: "Tick or untick an item on a format's checklist (ids come from get_song), or add a new item with `add`.",
    inputSchema: {
      type: "object",
      properties: {
        item_id: s("Checklist item id"),
        done: { type: "boolean", description: "true to tick, false to untick (default true)" },
        format_id: s("With `add`: the format to add an item to"),
        add: s("Text of a new checklist item"),
      },
    },
    async run(ctx, a) {
      if (str(a, "add")) {
        const f = await formatById(ctx, need(a, "format_id"));
        const { count } = await ctx.supabase.from("format_checklist").select("id", { count: "exact", head: true }).eq("format_id", f.id);
        check(await ctx.supabase.from("format_checklist").insert({ format_id: f.id, label: str(a, "add"), position: (count ?? 0) + 1 }));
        return { ok: true, added: str(a, "add") };
      }
      const done = a.done !== false;
      const rows = check(
        await ctx.supabase
          .from("format_checklist")
          .update(done ? { done_at: new Date().toISOString(), done_by: ctx.userId } : { done_at: null, done_by: null })
          .eq("id", need(a, "item_id"))
          .select("label"),
      );
      if (!rows?.length) throw new ToolError("Checklist item not found, or you can't edit it.");
      return { ok: true, item: rows[0].label, done };
    },
  },
  {
    name: "mark_published",
    title: "Mark a format as published",
    description: `Record that a format is live on a platform (${Object.keys(PLATFORM_LABEL).join(", ")}), with the post link. The first publication marks the format live.`,
    inputSchema: {
      type: "object",
      properties: {
        format_id: s("Format id from get_song"),
        platform: s("Platform", { enum: Object.keys(PLATFORM_LABEL) }),
        url: s("Link to the post"),
        published_at: DATE("Published on (default today)"),
      },
      required: ["format_id", "platform"],
    },
    async run(ctx, a) {
      const f = await formatById(ctx, need(a, "format_id"));
      check(
        await ctx.supabase.from("format_publications").upsert(
          {
            format_id: f.id,
            platform: need(a, "platform"),
            url: str(a, "url") ?? null,
            published_at: str(a, "published_at") ? ist(str(a, "published_at")!) : new Date().toISOString(),
          },
          { onConflict: "format_id,platform" },
        ),
      );
      return { ok: true, format: f.label, platform: a.platform };
    },
  },

  // ───────────── Tasks & comments ─────────────
  {
    name: "create_task",
    title: "Create a task",
    description: "Create a task on a page or song, optionally assigned to someone (by email) with a due date. The assignee is notified.",
    inputSchema: {
      type: "object",
      properties: { title: s("Task title"), code: CODE, page: s("Page slug (needed if no song code)"), assignee_email: s("Assignee's email"), due: DATE("Due"), details: s("Details") },
      required: ["title"],
    },
    async run(ctx, a) {
      const song = str(a, "code") ? await songByCode(ctx, str(a, "code")!) : null;
      const pageId = song?.page_id ?? (str(a, "page") ? (await pageBy(ctx, str(a, "page")!)).id : null);
      if (!pageId) throw new ToolError("Give a song code or a page.");
      const t = check(
        await ctx.supabase
          .from("tasks")
          .insert({
            title: need(a, "title"),
            page_id: pageId,
            song_id: song?.id ?? null,
            assignee_id: str(a, "assignee_email") ? (await personByEmail(ctx, str(a, "assignee_email")!)).id : null,
            due_at: str(a, "due") ? ist(str(a, "due")!) : null,
            details: str(a, "details") ?? null,
            created_by: ctx.userId,
            created_via: "agent",
          })
          .select("id, title, status")
          .single(),
      );
      return { ok: true, ...t };
    },
  },
  {
    name: "update_task",
    title: "Update a task",
    description: "Move a task (todo, doing, blocked, done), reassign it or change its due date.",
    inputSchema: {
      type: "object",
      properties: { task_id: s("Task id"), status: s("New status", { enum: ["todo", "doing", "blocked", "done"] }), assignee_email: s("New assignee"), due: DATE("New due date") },
      required: ["task_id"],
    },
    async run(ctx, a) {
      const patch: Record<string, unknown> = {};
      if (str(a, "status")) Object.assign(patch, { status: str(a, "status"), done_at: str(a, "status") === "done" ? new Date().toISOString() : null });
      if (str(a, "assignee_email")) patch.assignee_id = (await personByEmail(ctx, str(a, "assignee_email")!)).id;
      if (str(a, "due")) patch.due_at = ist(str(a, "due")!);
      const rows = check(await ctx.supabase.from("tasks").update(patch).eq("id", need(a, "task_id")).select("title, status"));
      if (!rows?.length) throw new ToolError("Task not found, or you can't edit it.");
      return { ok: true, ...rows[0] };
    },
  },
  {
    name: "add_comment",
    title: "Comment on a song",
    description: "Post a comment in a song's discussion. Shown as 'via AI'. @mention teammates by their Zinema ID (see list_team).",
    inputSchema: { type: "object", properties: { code: CODE, body: s("Comment text") }, required: ["code", "body"] },
    async run(ctx, a) {
      const song = await songByCode(ctx, need(a, "code"));
      const body = need(a, "body");
      const c = check(await ctx.supabase.from("comments").insert({ song_id: song.id, body, author_id: ctx.userId, via: "agent" }).select("id").single());
      const handles = [...body.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
      if (handles.length) {
        const { data: people } = await ctx.supabase.from("profiles").select("id, email, handle");
        const ids = (people ?? []).filter((p) => (handles.includes(p.email.split("@")[0].toLowerCase()) || (p.handle && handles.includes(p.handle))) && p.id !== ctx.userId).map((p) => p.id);
        if (ids.length && c) await ctx.supabase.from("mentions").insert(ids.map((user_id) => ({ comment_id: c.id, user_id })));
      }
      return { ok: true };
    },
  },

  {
    name: "sync_spotify",
    title: "Sync from Spotify",
    description: "Pull Zinema Music's releases from Spotify and fill in cover art, Spotify link, duration, release date and artist for songs matched by ISRC. Also lists Spotify tracks that aren't in Zinema OS yet.",
    inputSchema: { type: "object", properties: {} },
    async run(ctx) {
      if (!spotifyConfigured()) throw new ToolError("Spotify isn't connected to Zinema OS yet.");
      return syncSpotify(ctx.supabase);
    },
  },

  // ───────────── Google Drive ─────────────
  {
    name: "save_to_drive",
    title: "Save a file to the song's Drive folder",
    description:
      "Save something you produced (a caption sheet, CSV/Excel export, lyrics, report, image…) into the song's Google Drive folder. Give `text` for text files, `base64` for small binaries (up to ~3 MB), or `source_url` to copy a file from a public URL (up to 50 MB). Optionally also submit it for checking with submit_as_kind or submit_to_format_id.",
    inputSchema: {
      type: "object",
      properties: {
        code: CODE,
        filename: s("File name with extension, e.g. 'captions.csv'"),
        text: s("Text content"),
        base64: s("Base64 content"),
        source_url: s("Public https URL to fetch the file from"),
        mime_type: s("MIME type (guessed from the file name if omitted)"),
        folder: s("Sub-folder inside the song folder, e.g. 'Promo' or 'AI outputs' (default 'AI outputs')"),
        submit_as_kind: s("Also submit as this deliverable kind", { enum: Object.keys(KIND_LABEL) }),
        submit_to_format_id: s("Also submit to this format"),
        note: s("Note for the checker when submitting"),
      },
      required: ["code", "filename"],
    },
    async run(ctx, a) {
      if (!driveConfigured()) throw new ToolError("Google Drive isn't connected to Zinema OS yet. Ask an admin to finish the Drive setup.");
      const song = await songByCode(ctx, need(a, "code"));
      const can = check(await ctx.supabase.rpc("can_work_on_song", { p_song: song.id }));
      if (!can) throw new ToolError("You can view this song but not add files to it.");
      const filename = need(a, "filename");
      let bytes: Uint8Array;
      let mime = str(a, "mime_type");
      if (str(a, "text") !== undefined) bytes = new TextEncoder().encode(a.text as string);
      else if (str(a, "base64")) bytes = Buffer.from(str(a, "base64")!, "base64");
      else if (str(a, "source_url")) {
        const u = new URL(str(a, "source_url")!);
        if (u.protocol !== "https:" || /^(localhost|\[|\d+\.\d+\.\d+\.\d+$)/.test(u.hostname) || u.hostname.endsWith(".internal"))
          throw new ToolError("source_url must be a public https address.");
        const res = await fetch(u, { cache: "no-store", redirect: "follow" });
        if (!res.ok) throw new ToolError(`Couldn't fetch source_url (${res.status}).`);
        if (Number(res.headers.get("content-length") ?? 0) > 50 * 1024 * 1024) throw new ToolError("That file is over 50 MB. Upload it from the song page instead.");
        bytes = new Uint8Array(await res.arrayBuffer());
        mime ??= res.headers.get("content-type")?.split(";")[0];
      } else throw new ToolError("Give text, base64 or source_url.");
      mime ??= guessMime(filename);
      try {
        const root = await ensureSongFolder(ctx.supabase, song.id);
        const parent = await ensureFolder(str(a, "folder") ?? "AI outputs", root.id);
        const file = await uploadBytes({ name: filename, mimeType: mime, bytes, parentId: parent });
        const out: Record<string, unknown> = { ok: true, file: file.name, link: file.webViewLink, folder: folderUrl(parent), size_bytes: bytes.length };
        const formatId = str(a, "submit_to_format_id");
        const kind = str(a, "submit_as_kind");
        if (formatId || kind) {
          const deliverableId = formatId
            ? (await formatById(ctx, formatId)).deliverable_id
            : check(await ctx.supabase.from("deliverables").select("id").eq("song_id", song.id).eq("kind", kind!).eq("slot", 1).maybeSingle())?.id;
          if (!deliverableId) throw new ToolError("Saved to Drive, but the item to submit to doesn't exist on this song.");
          const v = check(
            await ctx.supabase
              .from("deliverable_versions")
              .insert({
                deliverable_id: deliverableId,
                drive_url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
                drive_file_id: file.id,
                mime_type: file.mimeType,
                size_bytes: bytes.length,
                md5: file.md5Checksum ?? null,
                note: str(a, "note") ?? null,
                submitted_by: ctx.userId,
                submitted_via: "agent",
              })
              .select("id, version")
              .single(),
          );
          out.submitted = v;
        }
        return out;
      } catch (e) {
        if (e instanceof DriveError) throw new ToolError(e.message);
        throw e;
      }
    },
  },
  {
    name: "list_drive_files",
    title: "List a song's Drive files",
    description: "Files and sub-folders in a song's Google Drive folder (or in one sub-folder, by folder_id).",
    inputSchema: { type: "object", properties: { code: CODE, folder_id: s("A sub-folder id from a previous call") }, required: ["code"] },
    readOnly: true,
    async run(ctx, a) {
      if (!driveConfigured()) throw new ToolError("Google Drive isn't connected to Zinema OS yet.");
      const song = await songByCode(ctx, need(a, "code"));
      if (!song.drive_folder_id) return { folder: null, files: [], note: "This song has no Drive folder yet. It's created on the first upload." };
      try {
        const id = str(a, "folder_id") ?? song.drive_folder_id;
        if (id !== song.drive_folder_id) {
          const f = await getFile(id);
          if (!f.parents?.includes(song.drive_folder_id)) throw new ToolError("That folder isn't inside this song's folder.");
        }
        const files = await listFolder(id);
        return {
          folder: folderUrl(id),
          files: files.map((f) => ({ id: f.id, name: f.name, type: f.mimeType, size: f.size, link: f.webViewLink, modified: f.modifiedTime })),
        };
      } catch (e) {
        if (e instanceof DriveError) throw new ToolError(e.message);
        throw e;
      }
    },
  },
];

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json", html: "text/html", srt: "application/x-subrip",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4", mov: "video/quicktime",
  };
  return map[ext] ?? "application/octet-stream";
}

