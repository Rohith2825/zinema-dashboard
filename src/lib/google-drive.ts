import "server-only";
import { createSign } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { selfiesPurged, stageLabel } from "./types";

/**
 * Google Drive as the single file store for Zinema OS.
 *
 * Two ways to authenticate (first one configured wins):
 *  1. Service account — GOOGLE_SERVICE_ACCOUNT_KEY (the JSON key, raw or base64).
 *     Service accounts have no storage of their own, so GOOGLE_DRIVE_ROOT_ID must be a folder
 *     inside a *shared drive* where the service account is a Content manager.
 *  2. A Google user — GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN.
 *     Files are owned by that account (works with a normal Gmail "My Drive").
 *
 * GOOGLE_DRIVE_ROOT_ID = the "Zinema OS" folder everything is filed under.
 */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
const ALL = "supportsAllDrives=true";

export type DriveFile = {
  id: string; name: string; mimeType: string; size?: string; md5Checksum?: string;
  webViewLink?: string; parents?: string[]; modifiedTime?: string;
};

export class DriveError extends Error {}

type Mode = "service_account" | "oauth" | null;
export function driveMode(): Mode {
  if (!process.env.GOOGLE_DRIVE_ROOT_ID) return null;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return "service_account";
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN && process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) return "oauth";
  return null;
}
export const driveConfigured = () => driveMode() !== null;
export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

function serviceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!.trim();
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const key = JSON.parse(json);
  return { client_email: key.client_email, private_key: String(key.private_key).replace(/\\n/g, "\n") };
}
export function driveIdentity(): string | null {
  try {
    return driveMode() === "service_account" ? serviceAccount().client_email : driveMode() === "oauth" ? "Google account (OAuth)" : null;
  } catch {
    return null;
  }
}

let cached: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const mode = driveMode();
  if (!mode) throw new DriveError("Google Drive isn't connected yet. An admin needs to add the Drive settings.");
  let body: URLSearchParams;
  if (mode === "service_account") {
    const sa = serviceAccount();
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
    body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` });
  } else {
    body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!,
    });
  }
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body, cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new DriveError(`Google sign-in for Drive failed: ${json.error_description ?? json.error ?? res.status}`);
  cached = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    const reason = detail?.error?.errors?.[0]?.reason;
    if (reason === "storageQuotaExceeded")
      throw new DriveError("Drive refused the file: the service account has no storage. Put the root folder in a shared drive, or connect a Google account instead.");
    throw new DriveError(`Google Drive: ${detail?.error?.message ?? res.statusText}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const FIELDS = "id,name,mimeType,size,md5Checksum,webViewLink,parents,modifiedTime";
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const clean = (s: string) => s.replace(/[\\/]/g, "-").trim().slice(0, 120);

export async function getFile(id: string): Promise<DriveFile> {
  return call(`${API}/files/${id}?fields=${FIELDS}&${ALL}`);
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const out = await call<{ files: DriveFile[] }>(
    `${API}/files?q=${q}&fields=files(${FIELDS})&orderBy=folder,name&pageSize=200&${ALL}&includeItemsFromAllDrives=true`,
  );
  return out.files;
}

/** Finds the named sub-folder, creating it if it isn't there. */
export async function ensureFolder(name: string, parentId: string): Promise<string> {
  const safe = clean(name);
  const q = encodeURIComponent(`name = '${esc(safe)}' and '${parentId}' in parents and mimeType = '${FOLDER}' and trashed = false`);
  const found = await call<{ files: { id: string }[] }>(`${API}/files?q=${q}&fields=files(id)&${ALL}&includeItemsFromAllDrives=true`);
  if (found.files[0]) return found.files[0].id;
  const made = await call<{ id: string }>(`${API}/files?fields=id&${ALL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: safe, mimeType: FOLDER, parents: [parentId] }),
  });
  return made.id;
}

type SongRef = { id: string; code: string; title: string; drive_folder_id: string | null; page: { name: string } | null };

/** Zinema OS / <Page> / <CODE · Title>. Created on first use and remembered on the song. */
export async function ensureSongFolder(supabase: SupabaseClient, songId: string): Promise<{ id: string; song: SongRef }> {
  const { data, error } = await supabase.from("songs").select("id, code, title, drive_folder_id, page:pages(name)").eq("id", songId).single();
  if (error || !data) throw new DriveError("Song not found, or you don't have access to it.");
  const song = data as unknown as SongRef;
  if (song.drive_folder_id) return { id: song.drive_folder_id, song };
  const pageName = (song.page?.name ?? "Zinema.music").replace("Zinema.music ", "").replace("Zinema.music", "Main");
  const pageFolder = await ensureFolder(pageName, process.env.GOOGLE_DRIVE_ROOT_ID!);
  const id = await ensureFolder(`${song.code} · ${song.title}`, pageFolder);
  await supabase.from("songs").update({ drive_folder_id: id }).eq("id", song.id);
  return { id, song };
}

/** The folder a file of this stage (or a named sub-folder) belongs in. */
export async function ensureSongSubfolder(supabase: SupabaseClient, songId: string, sub: string): Promise<string> {
  const { id } = await ensureSongFolder(supabase, songId);
  return ensureFolder(stageLabel(sub), id);
}

/**
 * Starts a resumable upload and returns its one-time session URL.
 * The browser sends the bytes straight to Google with that URL, so big WAV and video files never pass through our server.
 */
export async function createUploadSession(o: { name: string; mimeType: string; size: number; parentId: string; origin: string }): Promise<string> {
  const res = await fetch(`${UPLOAD}/files?uploadType=resumable&fields=${FIELDS}&${ALL}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": o.mimeType || "application/octet-stream",
      "X-Upload-Content-Length": String(o.size),
      Origin: o.origin, // lets the browser at this origin talk to the session URL
    },
    body: JSON.stringify({ name: clean(o.name), parents: [o.parentId] }),
  });
  const url = res.headers.get("location");
  if (!res.ok || !url) {
    const detail = await res.json().catch(() => null);
    throw new DriveError(`Google Drive wouldn't start the upload: ${detail?.error?.message ?? res.statusText}`);
  }
  return url;
}

/** Uploads a small file from the server (used by the MCP `save_to_drive` tool). */
export async function uploadBytes(o: { name: string; mimeType: string; bytes: Uint8Array; parentId: string }): Promise<DriveFile> {
  const boundary = `zinema${Date.now().toString(36)}`;
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: clean(o.name), parents: [o.parentId] })}\r\n--${boundary}\r\nContent-Type: ${o.mimeType}\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(head, "utf8"), Buffer.from(o.bytes), Buffer.from(`\r\n--${boundary}--`, "utf8")]);
  return call(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}&${ALL}`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** Makes a file viewable by anyone with the link (used for cover art, which is public artwork anyway). */
export async function shareWithLink(fileId: string): Promise<void> {
  await call(`${API}/files/${fileId}/permissions?${ALL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

/** Quick health check for the Connect page. */
export async function driveStatus(): Promise<{ ok: boolean; message: string; rootName?: string }> {
  if (!driveConfigured()) return { ok: false, message: "Not connected" };
  try {
    const root = await getFile(process.env.GOOGLE_DRIVE_ROOT_ID!);
    return { ok: true, message: "Connected", rootName: root.name };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Drive check failed" };
  }
}

/** Private attendance folder, outside the team-shared root: <Attendance> / <Person> / <YYYY-MM>. */
export async function attendanceFolder(person: { full_name?: string | null; email: string }, month: string): Promise<string> {
  const top = process.env.GOOGLE_DRIVE_ATTENDANCE_ID ?? (await ensureFolder("Zinema OS Attendance (private)", "root"));
  const who = await ensureFolder(`${person.full_name || person.email.split("@")[0]} (${person.email})`, top);
  return ensureFolder(month, who);
}

/** Streams a file's bytes (used to show attendance selfies without sharing them). */
export async function downloadFile(id: string): Promise<Response> {
  const res = await fetch(`${API}/files/${id}?alt=media&${ALL}`, { headers: { Authorization: `Bearer ${await accessToken()}` }, cache: "no-store" });
  if (!res.ok) throw new DriveError("Couldn't load the file from Drive.");
  return res;
}

/** Moves a file or folder to the Drive trash (Google empties it for good after 30 days). */
export async function trashFile(id: string): Promise<void> {
  await call(`${API}/files/${id}?${ALL}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
}

/**
 * Removes attendance selfies once their month is over and the 5-day grace period has passed:
 * from the 5th of a month, everything from earlier months goes. Attendance records themselves stay.
 */
export async function purgeAttendanceSelfies(today: string): Promise<{ removed: string[] }> {
  const top = process.env.GOOGLE_DRIVE_ATTENDANCE_ID ?? (await ensureFolder("Zinema OS Attendance (private)", "root"));
  const removed: string[] = [];
  for (const person of await listFolder(top)) {
    if (person.mimeType !== FOLDER) continue;
    for (const month of await listFolder(person.id)) {
      if (month.mimeType === FOLDER && /^\d{4}-\d{2}$/.test(month.name) && selfiesPurged(`${month.name}-01`, today)) {
        await trashFile(month.id);
        removed.push(`${person.name} / ${month.name}`);
      }
    }
  }
  return { removed };
}
