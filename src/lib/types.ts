export type StageKey = "lyrics" | "music" | "master_qc" | "distribution" | "video" | "promo" | "posting" | "live";
/** Stored per page (or for all pages). The old maker/checker/approver names only survive as permission checks. */
export type PageRole = "core" | "viewer" | "page_admin" | "approver" | "checker" | "maker";
export type AccessLevel = "owner" | "admin" | "core" | "viewer";
export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export type VersionStatus = "submitted" | "in_review" | "changes_requested" | "approved" | "superseded";
export type DeliverableKind =
  | "lyrics" | "sound_brief" | "rough_mix" | "song_metadata" | "master_wav" | "stems" | "artwork"
  | "lyric_video" | "visualizer" | "music_video" | "carousel" | "vertical"
  | "ai_music_video" | "static_image" | "audio_only";
export type FormatStatus = "planned" | "in_progress" | "in_review" | "approved" | "live" | "dropped";

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
  music_video: "Flagship music video",
  carousel: "Carousel",
  vertical: "Vertical",
  ai_music_video: "AI music video",
  static_image: "Image only (static video)",
  audio_only: "Audio only (no visual)",
};

export const FORMAT_STATUSES: { key: FormatStatus; label: string }[] = [
  { key: "planned", label: "Planned" },
  { key: "in_progress", label: "In progress" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "live", label: "Live" },
  { key: "dropped", label: "Dropped" },
];
export const formatStatusLabel = (k: string) => FORMAT_STATUSES.find((s) => s.key === k)?.label ?? k;

export const ROLES: { key: AccessLevel; label: string; desc: string; icon: string }[] = [
  { key: "owner", label: "Owner", desc: "Sees and does everything, including royalty splits and attendance. Approves stages.", icon: "★" },
  { key: "admin", label: "Admin", desc: "Every page. Adds people, sets access and approves stages. No owner-only data.", icon: "◆" },
  { key: "core", label: "Core team", desc: "Makes and checks everything on their pages — never their own file. Can't approve a stage.", icon: "♪" },
  { key: "viewer", label: "Viewer", desc: "Read-only: sees songs, files and calendars on their pages.", icon: "◉" },
];
export const roleLabel = (k?: string | null) => ROLES.find((r) => r.key === k)?.label ?? (k === "viewer" ? "Viewer" : "Core team");

export const TASK_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "Doing" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export type Page = { id: string; slug: string; name: string; code_prefix: string; is_main: boolean };
export type Profile = { id: string; full_name: string; email: string; is_org_admin: boolean; nickname?: string | null; handle?: string | null; bio?: string | null };

export type ActionState = { error?: string; ok?: string } | undefined;

export const TZ = "Asia/Kolkata";
export function fmtDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts }).format(new Date(d));
}
export function shortName(p?: { full_name?: string | null; email?: string | null; nickname?: string | null } | null) {
  if (!p) return "—";
  return p.nickname || p.full_name || p.email?.split("@")[0] || "—";
}

export type Platform =
  | "instagram" | "youtube" | "youtube_shorts" | "facebook" | "x" | "threads" | "snapchat"
  | "sharechat" | "moj" | "josh" | "spotify" | "apple_music" | "jiosaavn" | "other";

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  youtube_shorts: "YT Shorts",
  facebook: "Facebook",
  x: "X",
  threads: "Threads",
  snapchat: "Snapchat",
  sharechat: "ShareChat",
  moj: "Moj",
  josh: "Josh",
  spotify: "Spotify",
  apple_music: "Apple Music",
  jiosaavn: "JioSaavn",
  other: "Other",
};

/** Where each format usually goes. "Other" is always offered too. */
export const FORMAT_PLATFORMS: Partial<Record<DeliverableKind, Platform[]>> = {
  vertical: ["instagram", "youtube_shorts", "facebook", "snapchat", "moj", "josh", "sharechat"],
  carousel: ["instagram", "facebook", "threads", "x"],
  lyric_video: ["youtube", "facebook", "instagram"],
  music_video: ["youtube", "facebook", "instagram"],
  ai_music_video: ["youtube", "facebook", "instagram"],
  visualizer: ["youtube", "facebook", "instagram"],
  static_image: ["youtube", "facebook"],
  audio_only: ["spotify", "apple_music", "jiosaavn", "youtube"],
};

export const FORMAT_ICON: Partial<Record<DeliverableKind, string>> = {
  vertical: "▯",
  carousel: "▤",
  lyric_video: "¶",
  music_video: "▶",
  ai_music_video: "✦",
  visualizer: "◎",
  static_image: "▣",
  audio_only: "♪",
};

/** Who owns the song. Drives how royalty splits are classified. */
export type Ownership = "original" | "community";
export const OWNERSHIP: { key: Ownership; label: string; short: string; desc: string }[] = [
  { key: "original", label: "Zinema Original", short: "Original", desc: "Made and owned by Zinema" },
  { key: "community", label: "Community", short: "Community", desc: "Released with Zinema, owned by the artist or label" },
];
export const ownershipLabel = (k?: string | null) => OWNERSHIP.find((o) => o.key === k)?.label ?? "Zinema Original";

/** Attendance selfies are kept for their month plus 5 days. `day` and `today` are YYYY-MM-DD (India). */
export const SELFIE_GRACE_DAYS = 5;
export function selfiesPurged(day: string, today: string): boolean {
  const [y, m] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const month = day.slice(0, 7);
  if (month >= today.slice(0, 7)) return false;
  return month < prev || Number(today.slice(8, 10)) >= SELFIE_GRACE_DAYS;
}
