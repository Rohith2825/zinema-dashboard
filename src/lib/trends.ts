import "server-only";

/**
 * Live hashtag research for the caption writer, through Treg (TREG_API_KEY).
 * It asks Instagram's hashtag search for a few keywords and returns real hashtags with how many
 * posts each has, so captions use tags people actually use. Costs about $0.002 per keyword.
 */

export const trendsConfigured = () => Boolean(process.env.TREG_API_KEY);
export type TagIdea = { tag: string; posts: number };

const ENDPOINT = "https://treg.to/call/tikhub.x.instagram-v2-search-hashtags";
// Plain hashtags only: Latin letters, digits, underscore, Devanagari (Hindi, Marathi) and Tamil. Drops emoji and fancy-font copies.
const PLAIN = /^[a-z0-9_ऀ-ॿ஀-௿]{3,40}$/;

async function search(keyword: string): Promise<TagIdea[]> {
  const res = await fetch(`${ENDPOINT}?keyword=${encodeURIComponent(keyword)}`, {
    headers: { "X-Treg-Token": process.env.TREG_API_KEY! },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Treg said ${res.status}`);
  const json = (await res.json()) as { data?: { data?: { items?: { name?: string; media_count?: number }[] } } };
  return (json.data?.data?.items ?? [])
    .map((i) => ({ tag: String(i.name ?? "").toLowerCase(), posts: Number(i.media_count ?? 0) }))
    .filter((t) => PLAIN.test(t.tag) && t.posts >= 1000);
}

/** Search words for a song: its language's music tags, the lead artist, and the song title. */
export function trendKeywords(o: { page: string; language: string | null; artists?: string | null; title: string }): string[] {
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const where = `${o.page} ${o.language ?? ""}`.toLowerCase();
  const lang = ["tamil", "hindi", "marathi"].find((l) => where.includes(l));
  const base = lang ? [`${lang}song`, `${lang}music`] : where.includes("spiritual") ? ["devotionalsongs", "bhaktisongs"] : ["indiemusicindia", "indiansongs"];
  const artist = squash((o.artists ?? "").split(/[,&]/)[0] ?? "");
  const title = squash(o.title);
  return [...base, artist.length >= 4 ? artist : title.length >= 4 ? title : ""].filter(Boolean).slice(0, 3);
}

/** Real Instagram hashtags for these keywords, biggest first. Never throws: no research is better than no captions. */
export async function hashtagIdeas(keywords: string[]): Promise<TagIdea[]> {
  if (!trendsConfigured() || !keywords.length) return [];
  const found = await Promise.allSettled(keywords.map(search));
  const failed = found.filter((f) => f.status === "rejected");
  if (failed.length) console.error("hashtag research failed:", (failed[0] as PromiseRejectedResult).reason);
  const best = new Map<string, number>();
  for (const f of found) if (f.status === "fulfilled") for (const t of f.value.sort((a, b) => b.posts - a.posts).slice(0, 14)) best.set(t.tag, Math.max(best.get(t.tag) ?? 0, t.posts));
  return [...best.entries()].map(([tag, posts]) => ({ tag, posts })).sort((a, b) => b.posts - a.posts).slice(0, 30);
}
