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
