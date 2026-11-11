import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pulls Zinema Music's releases from Spotify and fills in what the catalog is missing.
 * Env: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_ARTIST_ID, SPOTIFY_MARKET (default IN).
 * Songs are matched on ISRC, so only songs with a distribution record are touched.
 */
export const spotifyConfigured = () => Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_ARTIST_ID);

const API = "https://api.spotify.com/v1";
type Track = { id: string; name: string; isrc: string | null; artists: string; url: string; durationMs: number; cover: string | null; releaseDate: string };

async function get<T>(token: string, path: string): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Spotify said ${res.status} for ${path.split("?")[0]}`);
  return res.json() as Promise<T>;
}

export async function fetchArtistTracks(): Promise<Track[]> {
  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const auth = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!auth.ok) throw new Error("Spotify rejected the client ID / secret.");
  const token = (await auth.json()).access_token as string;
  const market = process.env.SPOTIFY_MARKET || "IN";

  // Spotify caps this list at 10 per page.
  type Page = { items: { id: string }[]; next: string | null };
  const albumIds: string[] = [];
  let next: string | null = `/artists/${process.env.SPOTIFY_ARTIST_ID}/albums?include_groups=album,single&market=${market}&limit=10`;
  while (next) {
    const page: Page = await get<Page>(token, next);
    albumIds.push(...page.items.map((a) => a.id));
    next = page.next;
  }

  type Album = { release_date: string; images: { url: string }[]; tracks: { items: { id: string }[] } };
  type Full = { id: string; name: string; duration_ms: number; external_ids?: { isrc?: string }; external_urls: { spotify: string }; artists: { name: string }[] };
  const tracks: Track[] = [];
  for (const id of albumIds) {
    const album = await get<Album>(token, `/albums/${id}?market=${market}`);
    for (const t of album.tracks.items) {
      const full = await get<Full>(token, `/tracks/${t.id}?market=${market}`);
      tracks.push({
        id: full.id,
        name: full.name,
        isrc: full.external_ids?.isrc?.toUpperCase() ?? null,
        artists: full.artists.map((a) => a.name).join(", "),
        url: full.external_urls.spotify,
        durationMs: full.duration_ms,
        cover: album.images[0]?.url ?? null,
        releaseDate: album.release_date,
      });
    }
  }
  return tracks;
}

export type SpotifySync = { found: number; updated: string[]; notInZinemaOS: { name: string; isrc: string | null; url: string }[] };

/** Runs as the signed-in person (needs edit rights on the songs). Never overwrites artists or dates the team already entered. */
export async function syncSpotify(supabase: SupabaseClient): Promise<SpotifySync> {
  const tracks = await fetchArtistTracks();
  const { data: dists } = await supabase
    .from("distribution_records")
    .select("id, isrc, release_date, dsp_status, song:songs(id, code, artists, song_formats(id, kind))");
  type Dist = { id: string; isrc: string; release_date: string | null; dsp_status: string | null; song: { id: string; code: string; artists: string | null; song_formats: { id: string; kind: string }[] } | null };
  const byIsrc = new Map(((dists ?? []) as unknown as Dist[]).map((d) => [d.isrc.toUpperCase(), d]));

  const out: SpotifySync = { found: tracks.length, updated: [], notInZinemaOS: [] };
  for (const t of tracks) {
    const d = t.isrc ? byIsrc.get(t.isrc) : undefined;
    if (!d?.song) {
      out.notInZinemaOS.push({ name: t.name, isrc: t.isrc, url: t.url });
      continue;
    }
    const { error } = await supabase
      .from("songs")
      .update({
        spotify_track_id: t.id,
        spotify_url: t.url,
        cover_image_url: t.cover,
        duration_ms: t.durationMs,
        artists: d.song.artists ?? t.artists,
        spotify_synced_at: new Date().toISOString(),
      })
      .eq("id", d.song.id);
    if (error) throw new Error(`Couldn't update ${d.song.code}: ${error.message}`);
    if (!d.release_date || !d.dsp_status)
      await supabase.from("distribution_records").update({ release_date: d.release_date ?? t.releaseDate, dsp_status: d.dsp_status ?? "Live" }).eq("id", d.id);
    const audio = d.song.song_formats.find((f) => f.kind === "audio_only");
    if (audio)
      await supabase
        .from("format_publications")
        .upsert({ format_id: audio.id, platform: "spotify", url: t.url, published_at: new Date(`${t.releaseDate}T00:00:00+05:30`).toISOString() }, { onConflict: "format_id,platform" });
    out.updated.push(d.song.code);
  }
  return out;
}
