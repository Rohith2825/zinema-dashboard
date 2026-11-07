export type StageKey = "lyrics" | "music" | "master_qc" | "distribution" | "video" | "promo" | "posting" | "live";
export type PageRole = "page_admin" | "approver" | "checker" | "maker" | "viewer";
export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export type VersionStatus = "submitted" | "in_review" | "changes_requested" | "approved" | "superseded";
export type DeliverableKind =
  | "lyrics" | "sound_brief" | "rough_mix" | "song_metadata" | "master_wav" | "stems" | "artwork"
  | "lyric_video" | "visualizer" | "music_video" | "carousel" | "vertical";

export const STAGES: { key: StageKey; label: string }[] = [
  { key: "lyrics", label: "Lyrics" },
  { key: "music", label: "Music" },
  { key: "master_qc", label: "Mix & Master" },
  { key: "distribution", label: "Distribution" },
  { key: "video", label: "Video" },
  { key: "promo", label: "Promo" },
  { key: "posting", label: "Posting" },
  { key: "live", label: "Live" },
];
export const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label ?? k;

export const KIND_LABEL: Record<DeliverableKind, string> = {
  lyrics: "Lyrics",
  sound_brief: "Sound brief",
  rough_mix: "Rough mix",
  song_metadata: "Song metadata",
  master_wav: "Master WAV",
  stems: "Stems",
  artwork: "Artwork",
  lyric_video: "Lyric video",
  visualizer: "Visualizer",
  music_video: "Music video",
  carousel: "Carousel",
  vertical: "Vertical",
};

export const ROLES: { key: PageRole; label: string }[] = [
  { key: "page_admin", label: "Page admin" },
  { key: "approver", label: "Approver" },
  { key: "checker", label: "Checker" },
  { key: "maker", label: "Maker" },
  { key: "viewer", label: "Viewer" },
];

export const TASK_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "Doing" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export type Page = { id: string; slug: string; name: string; code_prefix: string; is_main: boolean };
export type Profile = { id: string; full_name: string; email: string; is_org_admin: boolean };

export type ActionState = { error?: string; ok?: string } | undefined;

export const TZ = "Asia/Kolkata";
export function fmtDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts }).format(new Date(d));
}
export function shortName(p?: { full_name?: string | null; email?: string | null } | null) {
  if (!p) return "—";
  return p.full_name || p.email?.split("@")[0] || "—";
}
