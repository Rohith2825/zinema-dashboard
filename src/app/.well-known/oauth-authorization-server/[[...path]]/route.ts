// Older MCP clients look for the authorization server's metadata on the MCP host itself: pass Supabase's through.
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const res = await fetch(`${base}/.well-known/oauth-authorization-server/auth/v1`, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return Response.json({ error: "OAuth server is not enabled on the Supabase project yet." }, { status: 503 });
  return Response.json(await res.json(), { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } });
}
