"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { STAGES, type ActionState } from "@/lib/types";
import { parseDriveId } from "@/lib/drive";
import { headers } from "next/headers";
import { DriveError, attendanceFolder, createUploadSession, driveConfigured, ensureFolder, ensureSongFolder, getFile, shareWithLink } from "@/lib/google-drive";
import { newToken, tokensEnabled } from "@/lib/mcp/auth";
import { spotifyConfigured, syncSpotify } from "@/lib/spotify";

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, uid: data.user.id };
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

function fail(message: string): ActionState {
  return { error: message };
}

function friendly(err: { message: string } | null): string {
  if (!err) return "Something went wrong.";
  const m = err.message;
  if (m.includes("row-level security")) return "You don't have permission to do that on this page.";
  if (m.includes("duplicate key")) return "That already exists.";
  if (m.includes("isrc_check") || m.includes("distribution_records_isrc_check")) return "ISRC must look like INP2X2501681 (12 characters).";
  if (m.includes("upc_check")) return "UPC must be 12–13 digits.";
  return m;
}

// ─────────── Songs ───────────
export async function createSong(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const title = str(fd, "title");
  const pageId = str(fd, "page_id");
  if (!title || !pageId) return fail("Title and page are required.");
  const { data, error } = await supabase
    .from("songs")
    .insert({
      title,
      page_id: pageId,
      planned_release_date: str(fd, "planned_release_date"),
      metadata: { language: str(fd, "language") },
      ownership: str(fd, "ownership") === "community" ? "community" : "original",
      created_by: uid,
      owner_id: uid,
    })
    .select("code")
    .single();
  if (error) return fail(friendly(error));
  redirect(`/songs/${data.code}`);
}

export async function updateSong(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const id = str(fd, "song_id");
  const { data: song } = await supabase.from("songs").select("metadata").eq("id", id!).single();
  const metadata = { ...((song?.metadata as Record<string, unknown>) ?? {}), language: str(fd, "language") };
  const cover = str(fd, "cover_url");
  if (cover && !parseDriveId(cover)) return fail("Cover art must be a Google Drive link.");
  const { error } = await supabase
    .from("songs")
    .update({
      title: str(fd, "title") ?? undefined,
      planned_release_date: str(fd, "planned_release_date"),
      metadata,
      artists: str(fd, "artists"),
      cover_url: cover,
      ...(str(fd, "ownership") ? { ownership: str(fd, "ownership") === "community" ? "community" : "original" } : {}),
    })
    .eq("id", id!);
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Saved." };
}

export async function advanceSong(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("advance_song", { p_song: str(fd, "song_id")! });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Moved to the next stage." };
}

// ─────────── Deliverables & reviews ───────────
export async function submitVersion(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const url = str(fd, "drive_url");
  if (!url) return fail("Paste a Google Drive link.");
  const fileId = parseDriveId(url);
  if (!fileId) return fail("That doesn't look like a Google Drive / Docs link.");
  const { error } = await supabase.from("deliverable_versions").insert({
    deliverable_id: str(fd, "deliverable_id")!,
    drive_url: url,
    drive_file_id: fileId,
    note: str(fd, "note"),
    submitted_by: uid,
  });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Submitted for checking." };
}

export async function reviewVersion(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const decision = str(fd, "decision");
  if (decision !== "approve" && decision !== "request_changes") return fail("Pick approve or request changes.");
  const comments = str(fd, "comments");
  if (decision === "request_changes" && !comments) return fail("Say what needs to change.");
  const { error } = await supabase.from("reviews").insert({
    version_id: str(fd, "version_id")!,
    reviewer_id: uid,
    decision,
    comments,
  });
  if (error) return fail(friendly(error).replace(/^.*Self-review.*$/, "You can't check your own submission."));
  refresh();
  return { ok: decision === "approve" ? "Approved." : "Changes requested." };
}

export async function assignDeliverable(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("deliverables")
    .update({ assignee_id: str(fd, "assignee_id"), checker_id: str(fd, "checker_id"), due_at: str(fd, "due_at") })
    .eq("id", str(fd, "deliverable_id")!);
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Saved." };
}

// ─────────── Credits, distribution, rights ───────────
export async function addCredit(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const name = str(fd, "name");
  const role = str(fd, "role");
  if (!name || !role) return fail("Name and role are required.");
  const { error } = await supabase
    .from("song_credits")
    .insert({ song_id: str(fd, "song_id")!, name, role, as_credited: str(fd, "as_credited") });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Added." };
}

export async function removeCredit(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("song_credits").delete().eq("id", str(fd, "id")!);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

export async function addDistribution(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const isrc = str(fd, "isrc")?.replace(/[-\s]/g, "").toUpperCase();
  if (!isrc) return fail("ISRC is required.");
  const distributor = str(fd, "distributor") ?? "PDL";
  const { error } = await supabase.from("distribution_records").insert({
    song_id: str(fd, "song_id")!,
    distributor,
    legacy: distributor === "DistroKid",
    isrc,
    upc: str(fd, "upc")?.replace(/\s/g, "") ?? null,
    catalog_number: str(fd, "catalog_number")?.toUpperCase() ?? null,
    release_date: str(fd, "release_date"),
    dsp_status: str(fd, "dsp_status"),
    proof_screenshot_drive_url: str(fd, "proof_url"),
    recorded_by: uid,
  });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Distribution recorded." };
}

export async function saveRights(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  // One split per line: Party, role, type (master|publishing), share %
  const lines = (str(fd, "splits") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const splits = [];
  for (const line of lines) {
    const [party, role, type, share] = line.split(",").map((s) => s.trim());
    const pct = Number(share?.replace("%", ""));
    if (!party || !role || !["master", "publishing"].includes(type) || !Number.isFinite(pct))
      return fail(`Couldn't read: "${line}". Use: Party, role, master|publishing, 50`);
    splits.push({ party, role, type, share_pct: pct });
  }
  const { error } = await supabase.from("song_rights").upsert({
    song_id: str(fd, "song_id")!,
    splits,
    notes: str(fd, "notes"),
    contract_drive_url: str(fd, "contract_drive_url"),
  });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Rights saved." };
}

// ─────────── Content plan ───────────
export async function addContentSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const label = str(fd, "label");
  const at = str(fd, "planned_at");
  if (!label || !at) return fail("Label and date are required.");
  const { error } = await supabase.from("content_slots").insert({
    song_id: str(fd, "song_id")!,
    page_id: str(fd, "page_id")!,
    label,
    planned_at: new Date(`${at}T18:00:00+05:30`).toISOString(),
    deliverable_id: str(fd, "deliverable_id"),
    created_by: uid,
  });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Added to the content calendar." };
}

/** Sets planned dates on the 6 mandatory formats (3 carousels + 3 verticals) around the release date. */
export async function generateContentPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const songId = str(fd, "song_id")!;
  const { data: song } = await supabase
    .from("songs")
    .select("planned_release_date, song_formats(id, mandatory, deliverable:deliverables(kind, slot))")
    .eq("id", songId)
    .single();
  if (!song?.planned_release_date) return fail("Set a planned release date first.");
  type F = { id: string; mandatory: boolean; deliverable: { kind: string; slot: number } | null };
  const formats = (song.song_formats ?? []) as unknown as F[];
  const plan: [number, string, number][] = [
    [-7, "vertical", 1],
    [-3, "carousel", 1],
    [0, "vertical", 2],
    [3, "carousel", 2],
    [7, "vertical", 3],
    [14, "carousel", 3],
  ];
  const base = new Date(`${song.planned_release_date}T18:00:00+05:30`).getTime();
  let n = 0;
  for (const [offset, kind, slot] of plan) {
    const f = formats.find((x) => x.mandatory && x.deliverable?.kind === kind && x.deliverable.slot === slot);
    if (!f) continue;
    const { error } = await supabase
      .from("song_formats")
      .update({ planned_at: new Date(base + offset * 86400000).toISOString() })
      .eq("id", f.id);
    if (error) return fail(friendly(error));
    n++;
  }
  if (!n) return fail("This song has no mandatory carousel/vertical formats.");
  refresh();
  return { ok: `Planned ${n} formats around the release date.` };
}

export async function removeContentSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("content_slots").delete().eq("id", str(fd, "id")!);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

export async function markSlotLive(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("content_slots")
    .update({ went_live_at: new Date().toISOString(), live_url: str(fd, "live_url") })
    .eq("id", str(fd, "id")!);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

// ─────────── Formats ───────────
const istDate = (d: string | null) => (d ? new Date(`${d}T18:00:00+05:30`).toISOString() : null);

export async function addFormat(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const kind = str(fd, "kind");
  if (!kind) return fail("Pick a format type.");
  const { error } = await supabase.rpc("add_song_format", { p_song: str(fd, "song_id")!, p_kind: kind, p_label: str(fd, "label") });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Format added." };
}

export async function updateFormat(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const folder = str(fd, "drive_folder_url");
  if (folder && !parseDriveId(folder)) return fail("Drive folder must be a Google Drive link.");
  const liveUrl = str(fd, "live_url");
  if (liveUrl && !/^https?:\/\//.test(liveUrl)) return fail("Live URL must start with https://");
  const status = str(fd, "status") ?? "planned";
  // The go-live date only counts while the format is Live (the DB marks a dated format as live).
  let wentLive = status === "live" ? istDate(str(fd, "went_live_at")) : null;
  if (status === "live" && !wentLive) wentLive = new Date().toISOString();
  const { error } = await supabase
    .from("song_formats")
    .update({
      label: str(fd, "label") ?? undefined,
      status,
      owner_id: str(fd, "owner_id"),
      planned_at: istDate(str(fd, "planned_at")),
      went_live_at: wentLive,
      live_url: liveUrl,
      drive_folder_url: folder,
      notes: str(fd, "notes"),
    })
    .eq("id", str(fd, "format_id")!);
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Saved." };
}

export async function toggleChecklistItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const done = str(fd, "done") === "1";
  const { error } = await supabase
    .from("format_checklist")
    .update(done ? { done_at: new Date().toISOString(), done_by: uid } : { done_at: null, done_by: null })
    .eq("id", str(fd, "id")!);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

export async function addChecklistItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const label = str(fd, "label");
  if (!label) return fail("Write the item first.");
  const formatId = str(fd, "format_id")!;
  const { count } = await supabase.from("format_checklist").select("id", { count: "exact", head: true }).eq("format_id", formatId);
  const { error } = await supabase.from("format_checklist").insert({ format_id: formatId, label, position: (count ?? 0) + 1 });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Added." };
}

export async function removeFormat(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { data: f, error } = await supabase
    .from("song_formats")
    .delete()
    .eq("id", str(fd, "format_id")!)
    .eq("mandatory", false)
    .select("deliverable_id")
    .maybeSingle();
  if (error) return fail(friendly(error));
  if (!f) return fail("Mandatory formats can't be removed — set them to Dropped instead.");
  if (f.deliverable_id) await supabase.from("deliverables").delete().eq("id", f.deliverable_id);
  refresh();
  return undefined;
}

export async function publishFormat(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const url = str(fd, "url");
  if (url && !/^https?:\/\//.test(url)) return fail("Link must start with https://");
  const day = str(fd, "published_at");
  const { error } = await supabase.from("format_publications").upsert(
    {
      format_id: str(fd, "format_id")!,
      platform: str(fd, "platform")!,
      url,
      published_at: day ? new Date(`${day}T18:00:00+05:30`).toISOString() : new Date().toISOString(),
    },
    { onConflict: "format_id,platform" },
  );
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Marked as published." };
}

export async function unpublishFormat(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("format_publications").delete().eq("id", str(fd, "id")!);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

// ─────────── Tasks & comments ───────────
export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const title = str(fd, "title");
  const pageId = str(fd, "page_id");
  if (!title || !pageId) return fail("Title and page are required.");
  const { error } = await supabase.from("tasks").insert({
    title,
    page_id: pageId,
    song_id: str(fd, "song_id"),
    assignee_id: str(fd, "assignee_id"),
    due_at: str(fd, "due_at") ? new Date(`${str(fd, "due_at")}T18:00:00+05:30`).toISOString() : null,
    details: str(fd, "details"),
    created_by: uid,
  });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Task created." };
}

export async function setTaskStatus(taskId: string, status: string): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("tasks")
    .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

export async function addComment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const body = str(fd, "body");
  if (!body) return fail("Write something first.");
  const { data, error } = await supabase
    .from("comments")
    .insert({ body, author_id: uid, song_id: str(fd, "song_id"), task_id: str(fd, "task_id") })
    .select("id")
    .single();
  if (error) return fail(friendly(error));

  // @mentions: match @handle against email name or first name.
  const handles = [...body.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
  if (handles.length) {
    const { data: people } = await supabase.from("profiles").select("id, full_name, nickname, handle, email");
    const ids = new Set<string>();
    for (const p of people ?? []) {
      const keys = [p.handle, p.email.split("@")[0], (p.nickname ?? "").split(" ")[0], (p.full_name ?? "").split(" ")[0]].filter(Boolean).map((k) => k!.toLowerCase());
      if (handles.some((h) => keys.includes(h)) && p.id !== uid) ids.add(p.id);
    }
    if (ids.size) await supabase.from("mentions").insert([...ids].map((user_id) => ({ comment_id: data.id, user_id })));
  }
  refresh();
  return { ok: "Posted." };
}

// ─────────── Team & inbox ───────────
/**
 * Sets one person's access in one go: admin, or core team / viewer on chosen pages or on all pages, or none.
 * Row-level security decides whether the caller may do this (admins manage access; only owners make admins).
 */
export async function setAccess(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const userId = str(fd, "user_id");
  const level = str(fd, "level"); // admin | core | viewer | none
  const scope = str(fd, "scope"); // all | pages
  const pageIds = fd.getAll("page_ids").filter((v): v is string => typeof v === "string" && v !== "");
  if (!userId || !level) return fail("Pick a person and an access level.");

  const { data: target } = await supabase.from("profiles").select("is_org_admin").eq("id", userId).maybeSingle();
  if (!target) return fail("That person hasn't signed in yet.");

  if (level === "admin" || target.is_org_admin) {
    const { error } = await supabase.rpc("set_admin", { p_user: userId, p_admin: level === "admin" });
    if (error) return fail(friendly(error));
  }
  // Start clean, then write the new scope.
  const wipe = await Promise.all([
    supabase.from("page_members").delete().eq("user_id", userId),
    supabase.from("all_page_roles").delete().eq("user_id", userId),
  ]);
  const wipeError = wipe.find((r) => r.error)?.error;
  if (wipeError) return fail(friendly(wipeError));

  if (level === "core" || level === "viewer") {
    if (scope === "all") {
      const { error } = await supabase.from("all_page_roles").insert({ user_id: userId, role: level });
      if (error) return fail(friendly(error));
    } else {
      if (pageIds.length === 0) return fail("Pick at least one page, or choose “All pages”.");
      const { error } = await supabase.from("page_members").insert(pageIds.map((page_id) => ({ user_id: userId, page_id, role: level })));
      if (error) return fail(friendly(error));
    }
  }
  refresh();
  return { ok: level === "none" ? "Access removed." : "Access updated." };
}

// ─────────── Profile ───────────
export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const handle = (str(fd, "handle") ?? "").replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{3,30}$/.test(handle)) return fail("Your ID needs 3–30 characters: letters, numbers, dots or underscores.");
  const nickname = str(fd, "nickname");
  const bio = str(fd, "bio");
  if ((nickname?.length ?? 0) > 40) return fail("Nickname can be up to 40 characters.");
  if ((bio?.length ?? 0) > 300) return fail("Description can be up to 300 characters.");
  const { error } = await supabase.from("profiles").update({ handle, nickname, bio }).eq("id", uid);
  if (error) return fail(error.message.includes("profiles_handle_key") ? `@${handle} is taken. Try another.` : friendly(error));
  refresh();
  return { ok: "Profile saved." };
}

export async function markAllRead(): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", uid).is("read_at", null);
  refresh();
  return undefined;
}

// ─────────── Google Drive uploads ───────────
// The browser sends the file straight to Google with a one-time session URL; we only start and record the upload.
type UploadTarget = { deliverableId?: string; coverForSong?: string };
export type UploadStart = { error?: string; sessionUrl?: string; folderId?: string };

async function uploadFolder(supabase: Awaited<ReturnType<typeof ctx>>["supabase"], target: UploadTarget) {
  if (target.coverForSong) {
    const { id } = await ensureSongFolder(supabase, target.coverForSong);
    return { songId: target.coverForSong, folderId: await ensureFolder("Cover art", id) };
  }
  const { data: d } = await supabase.from("deliverables").select("song_id, stage").eq("id", target.deliverableId!).maybeSingle();
  if (!d) throw new DriveError("That item doesn't exist, or you can't see it.");
  const { id } = await ensureSongFolder(supabase, d.song_id);
  const stage = STAGES.find((x) => x.key === d.stage)?.label ?? d.stage;
  return { songId: d.song_id as string, folderId: await ensureFolder(stage, id) };
}

export async function startUpload(target: UploadTarget, file: { name: string; type: string; size: number }): Promise<UploadStart> {
  const { supabase } = await ctx();
  if (!driveConfigured()) return { error: "Google Drive isn't connected yet. Paste a Drive link instead, or ask an admin to finish the Drive setup." };
  try {
    const { songId, folderId } = await uploadFolder(supabase, target);
    const { data: can } = await supabase.rpc("can_work_on_song", { p_song: songId });
    if (!can) return { error: "You can view this song but not add files to it." };
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    const sessionUrl = await createUploadSession({ name: file.name, mimeType: file.type, size: file.size, parentId: folderId, origin });
    return { sessionUrl, folderId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start the upload." };
  }
}

export async function finishUpload(target: UploadTarget, fileId: string, folderId: string, note?: string): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  try {
    const expected = await uploadFolder(supabase, target);
    const file = await getFile(fileId);
    if (expected.folderId !== folderId || !file.parents?.includes(folderId)) return fail("That file isn't in this song's folder.");
    const link = file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;
    if (target.coverForSong) {
      await shareWithLink(file.id).catch(() => undefined); // cover thumbnails need link sharing; fine if the drive forbids it
      const { error } = await supabase.from("songs").update({ cover_url: link }).eq("id", target.coverForSong);
      if (error) return fail(friendly(error));
    } else {
      const { error } = await supabase.from("deliverable_versions").insert({
        deliverable_id: target.deliverableId!,
        drive_url: link,
        drive_file_id: file.id,
        mime_type: file.mimeType,
        size_bytes: file.size ? Number(file.size) : null,
        md5: file.md5Checksum ?? null,
        note: note?.trim() || null,
        submitted_by: uid,
      });
      if (error) return fail(friendly(error));
    }
    refresh();
    return { ok: target.coverForSong ? "Cover art saved." : "Uploaded and submitted for checking." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't record the upload.");
  }
}

export async function openSongFolder(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  if (!driveConfigured()) return fail("Google Drive isn't connected yet.");
  try {
    await ensureSongFolder(supabase, str(fd, "song_id")!);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't create the folder.");
  }
  refresh();
  return { ok: "Drive folder ready." };
}

// ─────────── AI connections (MCP tokens) ───────────
type TokenState = { error?: string; ok?: string; token?: string } | undefined;
export async function createMcpToken(_: TokenState, fd: FormData): Promise<TokenState> {
  const { supabase } = await ctx();
  if (!tokensEnabled()) return { error: "Personal tokens aren't switched on yet (an admin needs to add SUPABASE_JWT_SECRET). Connecting with sign-in still works." };
  const name = str(fd, "name");
  if (!name) return { error: "Give the token a name, like “Claude Code on my laptop”." };
  const t = newToken();
  const { error } = await supabase.from("mcp_tokens").insert({ name, prefix: t.prefix, token_hash: t.hash });
  if (error) return { error: friendly(error) };
  refresh();
  return { ok: "Token created. Copy it now — it won't be shown again.", token: t.token };
}

export async function revokeMcpToken(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", str(fd, "id")!);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

// ─────────── Spotify ───────────
export async function syncFromSpotify(): Promise<ActionState> {
  const { supabase } = await ctx();
  if (!spotifyConfigured()) return fail("Spotify isn't connected yet. An admin needs to add the Spotify settings.");
  try {
    const r = await syncSpotify(supabase);
    refresh();
    const extra = r.notInZinemaOS.length ? ` ${r.notInZinemaOS.length} on Spotify aren't in Zinema OS yet: ${r.notInZinemaOS.map((x) => x.name).join(", ")}.` : "";
    return { ok: `Updated ${r.updated.length} of ${r.found} Spotify tracks.${extra}` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Spotify sync failed.");
  }
}

// ─────────── Attendance ───────────
const istNow = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "medium" }).format(new Date()); // 2026-11-12 09:31:05

async function selfieFolder(supabase: Awaited<ReturnType<typeof ctx>>["supabase"], uid: string) {
  const { data: me } = await supabase.from("profiles").select("full_name, email").eq("id", uid).single();
  if (!me) throw new DriveError("Profile not found.");
  return attendanceFolder(me, istNow().slice(0, 7));
}

export async function startSelfieUpload(kind: "check_in" | "check_out", size: number): Promise<UploadStart> {
  const { supabase, uid } = await ctx();
  if (!driveConfigured()) return { error: "Google Drive isn't connected, so selfies can't be saved yet." };
  const { data: enrolled } = await supabase.from("attendance_members").select("user_id").eq("user_id", uid).maybeSingle();
  if (!enrolled) return { error: "Attendance isn't switched on for you." };
  try {
    const folderId = await selfieFolder(supabase, uid);
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    const name = `${istNow().replace(/:/g, "-")} ${kind === "check_in" ? "check-in" : "check-out"}.jpg`;
    return { sessionUrl: await createUploadSession({ name, mimeType: "image/jpeg", size, parentId: folderId, origin }), folderId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start the selfie upload." };
  }
}

export async function markAttendance(p: { kind: "check_in" | "check_out"; lat: number; lng: number; accuracy: number | null; fileId: string; folderId: string }): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  try {
    const folderId = await selfieFolder(supabase, uid);
    const file = await getFile(p.fileId);
    if (folderId !== p.folderId || !file.parents?.includes(folderId) || !file.mimeType.startsWith("image/")) return fail("That selfie wasn't saved to your attendance folder.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't verify the selfie.");
  }
  const { error } = await supabase.rpc("mark_attendance", { p_kind: p.kind, p_lat: p.lat, p_lng: p.lng, p_accuracy: p.accuracy, p_selfie_file_id: p.fileId });
  if (error) return fail(error.message);
  refresh();
  return { ok: p.kind === "check_in" ? "Checked in. Have a good day." : "Checked out." };
}

/** Reads lat/lng out of a Google Maps link (short links are followed) or a "lat, lng" pair. */
async function coordsFrom(input: string): Promise<{ lat: number; lng: number } | null> {
  const pick = (text: string) => {
    const m =
      text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
      text.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/) ||
      text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      text.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  };
  const direct = pick(input);
  if (direct) return direct;
  try {
    const u = new URL(input);
    if (!/(^|\.)(google\.[a-z.]+|goo\.gl)$/.test(u.hostname)) return null;
    const res = await fetch(u, { redirect: "follow", cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });
    return pick(res.url) ?? pick((await res.text()).slice(0, 400_000));
  } catch {
    return null;
  }
}

export async function addOffice(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const name = str(fd, "name");
  const where = str(fd, "location");
  if (!name || !where) return fail("Give the office a name and a Google Maps link (or “lat, lng”).");
  const c = await coordsFrom(where);
  if (!c) return fail("Couldn't read a location from that. Open the place in Google Maps, copy the link from the address bar, or paste “13.0827, 80.2707”.");
  const { error } = await supabase.from("office_locations").insert({
    name,
    address: str(fd, "address"),
    maps_url: where.startsWith("http") ? where : `https://www.google.com/maps?q=${c.lat},${c.lng}`,
    lat: c.lat,
    lng: c.lng,
    radius_m: Number(str(fd, "radius_m")) || 1000,
  });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: `Added at ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}.` };
}

export async function setOfficeActive(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("office_locations").update({ active: str(fd, "active") === "1" }).eq("id", str(fd, "id")!);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

export async function setAttendanceRequired(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const userId = str(fd, "user_id")!;
  const { error } =
    str(fd, "required") === "1"
      ? await supabase.from("attendance_members").upsert({ user_id: userId })
      : await supabase.from("attendance_members").delete().eq("user_id", userId);
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}
