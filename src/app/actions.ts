"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { ActionState } from "@/lib/types";
import { parseDriveId } from "@/lib/drive";

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
  const { error } = await supabase
    .from("songs")
    .update({ title: str(fd, "title") ?? undefined, planned_release_date: str(fd, "planned_release_date"), metadata })
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

export async function generateContentPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  const songId = str(fd, "song_id")!;
  const { data: song } = await supabase
    .from("songs")
    .select("page_id, planned_release_date, deliverables(id, kind, slot)")
    .eq("id", songId)
    .single();
  if (!song?.planned_release_date) return fail("Set a planned release date first.");
  const ds = (song.deliverables ?? []) as { id: string; kind: string; slot: number }[];
  const d = (kind: string, slot: number) => ds.find((x) => x.kind === kind && x.slot === slot)?.id ?? null;
  const plan: [number, string, string, number][] = [
    [-7, "Teaser vertical", "vertical", 1],
    [-3, "Pre-release carousel", "carousel", 1],
    [0, "Release-day vertical", "vertical", 2],
    [3, "Lyrics carousel", "carousel", 2],
    [7, "Follow-up vertical", "vertical", 3],
    [14, "Behind-the-song carousel", "carousel", 3],
  ];
  const base = new Date(`${song.planned_release_date}T18:00:00+05:30`).getTime();
  const rows = plan.map(([offset, label, kind, slot]) => ({
    song_id: songId,
    page_id: song.page_id,
    label,
    planned_at: new Date(base + offset * 86400000).toISOString(),
    deliverable_id: d(kind, slot),
    created_by: uid,
  }));
  const { error } = await supabase.from("content_slots").insert(rows);
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Added 3 carousels + 3 verticals around the release date." };
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
    const { data: people } = await supabase.from("profiles").select("id, full_name, email");
    const ids = new Set<string>();
    for (const p of people ?? []) {
      const keys = [p.email.split("@")[0].toLowerCase(), (p.full_name ?? "").split(" ")[0].toLowerCase()];
      if (handles.some((h) => keys.includes(h)) && p.id !== uid) ids.add(p.id);
    }
    if (ids.size) await supabase.from("mentions").insert([...ids].map((user_id) => ({ comment_id: data.id, user_id })));
  }
  refresh();
  return { ok: "Posted." };
}

// ─────────── Team & inbox ───────────
export async function addMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("page_members")
    .insert({ user_id: str(fd, "user_id")!, page_id: str(fd, "page_id")!, role: str(fd, "role")! });
  if (error) return fail(friendly(error));
  refresh();
  return { ok: "Role added." };
}

export async function removeMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("page_members")
    .delete()
    .match({ user_id: str(fd, "user_id")!, page_id: str(fd, "page_id")!, role: str(fd, "role")! });
  if (error) return fail(friendly(error));
  refresh();
  return undefined;
}

export async function markAllRead(): Promise<ActionState> {
  const { supabase, uid } = await ctx();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", uid).is("read_at", null);
  refresh();
  return undefined;
}
