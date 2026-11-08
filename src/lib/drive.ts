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
