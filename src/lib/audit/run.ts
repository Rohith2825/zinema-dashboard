import "server-only";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DriveError, downloadBytes, downloadFile, exportDocText, getFile } from "@/lib/google-drive";
import { KIND_LABEL, type DeliverableKind } from "@/lib/types";
import { AiError, aiConfigured, reviewArtwork, reviewLyrics, writeCaptions, type Captions, type SongContext } from "./ai";
import { judgeArtwork, judgeMix, reportMd, verdictOf, type ArtMetrics, type Finding, type Status, type Verdict } from "./judge";
import { docxText, lyricStats } from "./text";
import { NotWavError, analyzeWav } from "./wav";

/** Which audit runs on which kind of file. */
export const AUDIT_FOR: Partial<Record<DeliverableKind, { skill: string; label: string }>> = {
  master_wav: { skill: "mix-audit@1.0", label: "Mix audit" },
  artwork: { skill: "artwork-audit@1.0", label: "Artwork audit" },
  lyrics: { skill: "lyric-review@1.0", label: "Lyric review" },
};

export class AuditError extends Error {}
export type AuditResult = { skill: string; verdict: Verdict; findings: Finding[]; report_md: string; metrics: object };

type SongRow = {
  id: string; code: string; title: string; artists: string | null; page_id: string; duration_ms: number | null;
  planned_release_date: string | null; spotify_url: string | null; metadata: Record<string, unknown> | null;
  page: { name: string; language: string | null } | null;
};
const SONG = "id, code, title, artists, page_id, duration_ms, planned_release_date, spotify_url, metadata, page:pages(name, language)";

async function context(supabase: SupabaseClient, song: SongRow): Promise<SongContext> {
  const [credits, dist] = await Promise.all([
    supabase.from("song_credits").select("role, name, as_credited").eq("song_id", song.id),
    supabase.from("distribution_records").select("isrc, release_date").eq("song_id", song.id).limit(1),
  ]);
  const mood = song.metadata?.mood ?? song.metadata?.brief;
  return {
    code: song.code, title: song.title, page: song.page?.name ?? "Zinema Music", language: song.page?.language ?? null, artists: song.artists,
    credits: (credits.data ?? []).map((c) => ({ role: String(c.role).replace(/_/g, " "), name: c.as_credited || c.name })),
    isrc: dist.data?.[0]?.isrc ?? null,
    release_date: dist.data?.[0]?.release_date ?? song.planned_release_date,
    mood: typeof mood === "string" ? mood : null,
    spotify_url: song.spotify_url,
  };
}

/** Reads a lyric file from Drive: Google Doc, Word, plain text, or PDF (PDFs are handed to the AI as they are). */
export async function readLyrics(fileId: string): Promise<{ text: string } | { pdf: Buffer }> {
  const file = await getFile(fileId);
  const name = file.name.toLowerCase();
  if (file.mimeType === "application/vnd.google-apps.document") return { text: await exportDocText(fileId) };
  if (file.mimeType === "application/pdf" || name.endsWith(".pdf")) return { pdf: await downloadBytes(fileId, 20 * 1048576) };
  if (name.endsWith(".docx") || file.mimeType.includes("wordprocessingml")) return { text: docxText(await downloadBytes(fileId, 20 * 1048576)) };
  if (file.mimeType.startsWith("text/") || /\.(txt|md|lrc)$/.test(name)) return { text: (await downloadBytes(fileId, 2 * 1048576)).toString("utf8") };
  throw new AuditError("Lyrics need to be a Google Doc, a Word file, a PDF or a text file to be reviewed.");
}

async function mixAudit(fileId: string, rules: object | null, song: SongRow): Promise<Omit<AuditResult, "skill">> {
  try {
    const res = await downloadFile(fileId);
    const metrics = await analyzeWav(res.body as unknown as AsyncIterable<Uint8Array>);
    const findings = judgeMix(metrics, rules, song.duration_ms ? song.duration_ms / 1000 : null);
    return { verdict: verdictOf(findings), findings, metrics, report_md: reportMd("Mix audit", findings) };
  } catch (e) {
    if (!(e instanceof NotWavError)) throw e;
    const findings: Finding[] = [{ check: "File format", status: "fail", value: e.detected.replace(/^an? /, ""), target: "WAV, stereo", fix: "Export the master as a WAV file (24-bit, 44.1 or 48 kHz, stereo) and submit that." }];
    return { verdict: "fail", findings, metrics: { container: "other" }, report_md: reportMd("Mix audit", findings) };
  }
}

async function artworkAudit(fileId: string, rules: object | null, ctx: SongContext): Promise<Omit<AuditResult, "skill">> {
  const bytes = await downloadBytes(fileId, 40 * 1048576);
  let metrics: ArtMetrics;
  try {
    const img = sharp(bytes);
    const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);
    const space = String(meta.space ?? "");
    metrics = {
      format: meta.format ?? "unknown", width: meta.width ?? 0, height: meta.height ?? 0,
      colour: /rgb/i.test(space) ? "rgb" : space === "cmyk" ? "cmyk" : space === "b-w" || space === "grey16" ? "greyscale" : space || "unknown",
      has_alpha: Boolean(meta.hasAlpha) && !stats.isOpaque, size_bytes: bytes.length, dpi: meta.density ?? null,
    };
  } catch {
    const findings: Finding[] = [{ check: "File type", status: "fail", value: "not an image we can open", target: "JPG or PNG", fix: "Export the cover as a JPG or PNG and submit that." }];
    return { verdict: "fail", findings, metrics: {}, report_md: reportMd("Artwork audit", findings) };
  }
  const findings = judgeArtwork(metrics, rules);
  let notes: string | undefined;
  if (!aiConfigured()) {
    findings.push({ check: "Look check (text, logos, thumbnail)", status: "info", value: "not run: the AI reviewer isn't switched on", target: "for information" });
  } else {
    try {
      const small = await sharp(bytes).flatten({ background: "#ffffff" }).resize(1024, 1024, { fit: "inside" }).toColourspace("srgb").jpeg({ quality: 85 }).toBuffer();
      const r = await reviewArtwork(small, ctx);
      const add = (check: string, x: { status: Status; found: string; fix: string }) => findings.push({ check, status: x.status, value: x.found, target: "AI opinion", ...(x.status !== "pass" && x.fix ? { fix: x.fix } : {}) });
      add("Store rules", r.store_rules);
      add("Title & artist text", r.text_matches_song);
      add("Thumbnail", r.thumbnail);
      add("Image quality", r.image_quality);
      notes = `### Reviewer's note\n${r.summary}`;
      Object.assign(metrics, { ai_review: r });
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      findings.push({ check: "Look check (text, logos, thumbnail)", status: "info", value: `not run: ${e.message}`, target: "for information" });
    }
  }
  return { verdict: verdictOf(findings), findings, metrics, report_md: reportMd("Artwork audit", findings, notes) };
}

async function lyricReview(fileId: string, ctx: SongContext): Promise<Omit<AuditResult, "skill">> {
  const lyrics = await readLyrics(fileId);
  if ("text" in lyrics && lyrics.text.trim().length < 40) throw new AuditError("That file has almost no text in it. Check it's the lyric.");
  const stats = "text" in lyrics ? lyricStats(lyrics.text) : null;
  const r = await reviewLyrics(lyrics, ctx, stats ?? undefined);
  const scored = (check: string, score: number, note: string): Finding => ({ check, status: score >= 7 ? "pass" : "warn", value: `${Math.round(score)}/10`, target: "7/10 or more", ...(score < 7 ? { fix: note } : {}) });
  const findings: Finding[] = [
    scored("Hook", r.hook.score, r.hook.note),
    scored("Singability", r.singability.score, r.singability.note),
    scored("Wordplay", r.wordplay.score, r.wordplay.note),
    scored("Short-video fit", r.short_video_fit.score, r.short_video_fit.note),
    { check: "Sensitivity", status: r.sensitivity.status, value: r.sensitivity.status === "pass" ? "nothing found" : r.sensitivity.note, target: "nothing that could offend or copy", ...(r.sensitivity.status !== "pass" ? { fix: r.sensitivity.note } : {}) },
  ];
  if (stats) findings.push({ check: "Length", status: "info", value: `${stats.lines} lines, ${stats.words} words${stats.most_repeated_line ? `; most repeated line sung ${stats.repeats}×` : ""}`, target: "for information" });
  const quote = (s: string) => s.split("\n").map((l) => `> ${l}`).join("\n");
  const notes = [
    `### Reviewer's note\n${r.summary}`,
    `### Strongest line\n${quote(r.hook.line)}`,
    `### Best 15 seconds for a reel\n${quote(r.short_video_fit.best_15_seconds)}`,
    r.alternative_hooks.length ? `### Other hook ideas\n${r.alternative_hooks.map((h) => `- ${h}`).join("\n")}` : "",
    r.suggestions.length ? `### Suggestions\n${r.suggestions.map((h) => `- ${h}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  return { verdict: verdictOf(findings), findings, metrics: { ...(stats ?? {}), language: r.language, scores: { hook: r.hook.score, singability: r.singability.score, wordplay: r.wordplay.score, short_video_fit: r.short_video_fit.score } }, report_md: reportMd("Lyric review", findings, notes) };
}

/** Runs the audit that matches a submitted file and saves the result. Runs as the signed-in person. */
export async function runAudit(supabase: SupabaseClient, versionId: string, via: "user" | "agent" = "user"): Promise<AuditResult> {
  const { data: v } = await supabase
    .from("deliverable_versions")
    .select(`id, drive_file_id, deliverable:deliverables(kind, song:songs(${SONG}))`)
    .eq("id", versionId).maybeSingle();
  const d = (v as unknown as { drive_file_id: string; deliverable: { kind: DeliverableKind; song: SongRow } | null } | null);
  if (!d?.deliverable?.song) throw new AuditError("That file doesn't exist, or you can't see it.");
  const { kind, song } = d.deliverable;
  const audit = AUDIT_FOR[kind];
  if (!audit) throw new AuditError(`There's no automatic audit for ${KIND_LABEL[kind] ?? kind} yet.`);
  const { data: can } = await supabase.rpc("can_work_on_song", { p_song: song.id });
  if (!can) throw new AuditError("You can view this song but not run audits on it.");

  const { data: thr } = await supabase.from("audit_thresholds").select("rules").eq("page_id", song.page_id).eq("kind", kind).maybeSingle();
  const rules = (thr?.rules as object | null) ?? null;
  let out: Omit<AuditResult, "skill">;
  try {
    out = kind === "master_wav" ? await mixAudit(d.drive_file_id, rules, song)
      : kind === "artwork" ? await artworkAudit(d.drive_file_id, rules, await context(supabase, song))
      : await lyricReview(d.drive_file_id, await context(supabase, song));
  } catch (e) {
    if (e instanceof DriveError || e instanceof AiError) throw new AuditError(e.message);
    throw e;
  }
  const { error } = await supabase.from("audit_runs").insert({ version_id: versionId, skill: audit.skill, verdict: out.verdict, metrics: out.metrics, findings: out.findings, report_md: out.report_md, created_via: via });
  if (error) throw new AuditError(error.message.includes("row-level security") ? "You don't have permission to save audits on this song." : error.message);
  return { skill: audit.skill, ...out };
}

/** The newest lyric text on a song (approved version if there is one), or null. */
export async function songLyrics(supabase: SupabaseClient, songId: string): Promise<string | null> {
  const { data } = await supabase.from("deliverables").select("deliverable_versions(drive_file_id, status, version)").eq("song_id", songId).eq("kind", "lyrics");
  const versions = (data ?? []).flatMap((x) => x.deliverable_versions as { drive_file_id: string; status: string; version: number }[]);
  const pick = versions.sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved") || b.version - a.version)[0];
  if (!pick) return null;
  try {
    const l = await readLyrics(pick.drive_file_id);
    return "text" in l ? l.text : null;
  } catch {
    return null;
  }
}

/** Drafts captions for every platform and saves them on the song for a person to review. */
export async function draftCaptions(supabase: SupabaseClient, uid: string, songCode: string, brief: string | null, via: "user" | "agent" = "user"): Promise<Captions> {
  const { data } = await supabase.from("songs").select(SONG).eq("code", songCode.toUpperCase()).maybeSingle();
  const song = data as unknown as SongRow | null;
  if (!song) throw new AuditError("Song not found, or you can't see it.");
  const { data: can } = await supabase.rpc("can_work_on_song", { p_song: song.id });
  if (!can) throw new AuditError("You can view this song but not write captions for it.");
  try {
    const captions = await writeCaptions(await context(supabase, song), { lyrics: await songLyrics(supabase, song.id), brief });
    const { error } = await supabase.from("song_captions").insert({ song_id: song.id, captions, brief, created_by: uid, created_via: via });
    if (error) throw new AuditError(error.message);
    return captions;
  } catch (e) {
    if (e instanceof AiError) throw new AuditError(e.message);
    throw e;
  }
}
