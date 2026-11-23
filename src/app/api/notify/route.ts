import { createClient } from "@supabase/supabase-js";
import { noticeEmail, sendEmail, type Notice } from "@/lib/email";

/**
 * Called by the database when a notification is created (see migration 0026).
 * The request carries the notification id and its one-time token; trading them in returns the
 * message exactly once, so a replayed or guessed request sends nothing.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: string; token?: string } | null;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!body?.id || !body.token || !uuid.test(body.id) || !uuid.test(body.token)) return Response.json({ ok: false }, { status: 400 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("claim_notification_email", { p_id: body.id, p_token: body.token });
  if (error) return Response.json({ ok: false, reason: "lookup failed" }, { status: 500 });
  const notice = (data as Notice[] | null)?.[0];
  if (!notice) return Response.json({ ok: true, sent: false }); // already sent, switched off, or not a real request

  const result = await sendEmail(notice.to_email, noticeEmail(notice));
  if (!result.ok) {
    console.error("notification email failed:", result.error);
    // Don't leave it recorded as sent.
    await supabase.rpc("release_notification_email", { p_id: body.id, p_token: body.token });
  }
  return Response.json({ ok: result.ok, sent: result.ok, ...(result.ok ? {} : { reason: result.error }) }, { status: result.ok ? 200 : 502 });
}
