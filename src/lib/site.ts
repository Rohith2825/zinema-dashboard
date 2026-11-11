export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dashboard.zinema.music").replace(/\/$/, "");
export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/** A path on this site that is safe to send someone to after sign-in. Anything else becomes "/". */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return "/";
  return next;
}
