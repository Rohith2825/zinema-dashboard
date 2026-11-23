import { createClient } from "@/utils/supabase/server";
import { AuditError, runAudit } from "@/lib/audit/run";

// A full master can be 100 MB+: reading it from Drive and measuring it takes a while.
export const maxDuration = 300;

/** Runs the matching audit on a submitted file, as the signed-in person. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { version_id?: string } | null;
  if (!body?.version_id || !/^[0-9a-f-]{36}$/i.test(body.version_id)) return Response.json({ error: "Missing file." }, { status: 400 });
  try {
    const out = await runAudit(supabase, body.version_id);
    return Response.json({ ok: true, verdict: out.verdict });
  } catch (e) {
    if (e instanceof AuditError) return Response.json({ error: e.message }, { status: 422 });
    console.error("audit failed:", e);
    return Response.json({ error: "The audit couldn't finish. Try again." }, { status: 500 });
  }
}
