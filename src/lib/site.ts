export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dashboard.zinema.music").replace(/\/$/, "");
export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
