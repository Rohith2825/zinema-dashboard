import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TZ } from "@/lib/types";

/**
 * Performance numbers for released songs. YouTube views, likes and comments are pulled with the
 * YouTube Data API (YOUTUBE_API_KEY) for every YouTube link marked as published; other platforms'
 * numbers are saved by a person or an assistant (`record_metric`).
 */

export const youtubeConfigured = () => Boolean(process.env.YOUTUBE_API_KEY);
export class PerformanceError extends Error {}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    return u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Saves today's YouTube numbers for one song (or every song the person can work on). */
export async function pullYouTube(supabase: SupabaseClient, songId?: string): Promise<{ videos: number; saved: number; skipped: string[] }> {
  if (!youtubeConfigured()) throw new PerformanceError("YouTube numbers aren't switched on yet. An admin needs to add YOUTUBE_API_KEY.");
  let q = supabase.from("format_publications").select("platform, url, format:song_formats!inner(song_id)").in("platform", ["youtube", "youtube_shorts"]).not("url", "is", null);
  if (songId) q = q.eq("format.song_id", songId);
  const { data, error } = await q;
  if (error) throw new PerformanceError(error.message);
  const links = ((data ?? []) as unknown as { platform: string; url: string; format: { song_id: string } }[])
    .map((p) => ({ ...p, id: youtubeId(p.url) }));
  const skipped = links.filter((l) => !l.id).map((l) => l.url);
  const good = links.filter((l) => l.id);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const rows: object[] = [];
  for (let i = 0; i < good.length; i += 50) {
    const batch = good.slice(i, i + 50);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.map((b) => b.id).join(",")}&key=${process.env.YOUTUBE_API_KEY}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new PerformanceError(`YouTube said: ${json?.error?.message ?? res.status}`);
    const stats = new Map<string, Record<string, string>>((json.items ?? []).map((v: { id: string; statistics: Record<string, string> }) => [v.id, v.statistics]));
    for (const b of batch) {
      const s = stats.get(b.id!);
      if (!s) { skipped.push(b.url); continue; } // private, deleted or wrong link
      for (const [metric, key] of [["views", "viewCount"], ["likes", "likeCount"], ["comments", "commentCount"]] as const)
        if (s[key] !== undefined) rows.push({ song_id: b.format.song_id, platform: b.platform, url: b.url, metric, value: Number(s[key]), captured_on: today, source: "youtube_api" });
    }
  }
  if (rows.length) {
    const { error: e } = await supabase.from("song_metrics").upsert(rows, { onConflict: "song_id,platform,url,metric,captured_on" });
    if (e) throw new PerformanceError(e.message.includes("row-level security") ? "You can view these songs but not save numbers for them." : e.message);
  }
  return { videos: good.length - skipped.filter((u) => good.some((g) => g.url === u)).length, saved: rows.length, skipped };
}

export type MetricLine = { song_id: string; platform: string; url: string; metric: string; value: number; captured_on: string; change_7d: number | null; source: string };

/** Newest number for each link and metric, with the change against about a week earlier. */
export async function latestMetrics(supabase: SupabaseClient, songId?: string): Promise<MetricLine[]> {
  let q = supabase.from("song_metrics").select("song_id, platform, url, metric, value, captured_on, source").order("captured_on", { ascending: false }).limit(5000);
  if (songId) q = q.eq("song_id", songId);
  const { data } = await q;
  const groups = new Map<string, { value: number; captured_on: string; source: string; song_id: string; platform: string; url: string; metric: string }[]>();
  for (const r of data ?? []) {
    const k = `${r.song_id}|${r.platform}|${r.url}|${r.metric}`;
    groups.set(k, [...(groups.get(k) ?? []), r as never]);
  }
  return [...groups.values()].map((rows) => {
    const [now] = rows;
    const cut = new Date(new Date(now.captured_on).getTime() - 6 * 86400000).toISOString().slice(0, 10);
    const before = rows.find((r) => r.captured_on <= cut);
    return { ...now, value: Number(now.value), change_7d: before ? Number(now.value) - Number(before.value) : null };
  });
}
