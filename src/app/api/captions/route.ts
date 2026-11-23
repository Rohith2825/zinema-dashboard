import { createClient } from "@/utils/supabase/server";
import { AuditError, draftCaptions } from "@/lib/audit/run";

export const maxDuration = 300;

/** Drafts captions for a song, as the signed-in person. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { code?: string; brief?: string } | null;
  if (!body?.code || !/^[A-Za-z]{2,5}-\d{1,6}$/.test(body.code)) return Response.json({ error: "Missing song." }, { status: 400 });
  try {
    await draftCaptions(supabase, uid, body.code, body.brief?.trim().slice(0, 600) || null);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AuditError) return Response.json({ error: e.message }, { status: 422 });
    console.error("captions failed:", e);
    return Response.json({ error: "Couldn't write the captions. Try again." }, { status: 500 });
  }
}
