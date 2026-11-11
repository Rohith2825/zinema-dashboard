import { driveConfigured, purgeAttendanceSelfies } from "@/lib/google-drive";
import { TZ } from "@/lib/types";

/**
 * Daily job (see vercel.json). Vercel calls it with "Authorization: Bearer <CRON_SECRET>".
 * From the 5th of each month it removes attendance selfies of earlier months from Google Drive.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!driveConfigured()) return Response.json({ ok: false, reason: "Drive not connected" });
  try {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
    return Response.json({ ok: true, today, ...(await purgeAttendanceSelfies(today)) });
  } catch (e) {
    return Response.json({ ok: false, reason: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
