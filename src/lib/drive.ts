/** Pulls the Drive/Docs file or folder ID out of a share link. */
export function parseDriveId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)(drive|docs)\.google\.com$/.test(u.hostname)) return null;
    const m =
      u.pathname.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([\w-]{10,})/) ||
      u.pathname.match(/\/folders\/([\w-]{10,})/);
    return m?.[1] ?? u.searchParams.get("id");
  } catch {
    return null;
  }
}

/** Thumbnail URL for a Drive image (the file must be shared as "anyone with the link"). */
export function driveThumb(url: string | null | undefined, width = 600): string | null {
  if (!url) return null;
  const id = parseDriveId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}` : null;
}

/** Best cover we have: the team's Drive artwork first, then the one pulled from Spotify. */
export function coverSrc(song: { cover_url?: string | null; cover_image_url?: string | null }, width = 600): string | null {
  return driveThumb(song.cover_url, width) ?? song.cover_image_url ?? null;
}
