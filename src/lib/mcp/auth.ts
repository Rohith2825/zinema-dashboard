import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const TOKEN_PREFIX = "zos_";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function newToken() {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), prefix: token.slice(0, 10) };
}
/** Personal tokens need the project's JWT secret so calls can run as that person. */
export const tokensEnabled = () => Boolean(process.env.SUPABASE_JWT_SECRET);

function clientFor(jwt: string): SupabaseClient {
  return createClient(URL_, KEY, {
    accessToken: async () => jwt,
    global: { headers: { "x-zinema-via": "mcp" } },
  });
}

/** A 10-minute Supabase JWT for this user, so row-level security applies exactly as it does on the website. */
function mintJwt(userId: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: userId, role: "authenticated", aud: "authenticated", iat: now, exp: now + 600, iss: `${URL_}/auth/v1` })}`;
  return `${unsigned}.${createHmac("sha256", process.env.SUPABASE_JWT_SECRET!).update(unsigned).digest("base64url")}`;
}

export type McpAuth = { supabase: SupabaseClient; userId: string; method: "oauth" | "token" };

/**
 * Accepts either a Supabase access token (issued by Supabase's OAuth 2.1 server when someone connects
 * Claude or another AI client) or a personal `zos_…` token created on the Connect page.
 */
export async function authenticate(request: Request): Promise<McpAuth | null> {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!bearer) return null;

  if (bearer.startsWith(TOKEN_PREFIX)) {
    if (!tokensEnabled()) return null;
    const anon = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userId } = await anon.rpc("mcp_token_user", { p_hash: hashToken(bearer) });
    if (typeof userId !== "string") return null;
    return { supabase: clientFor(mintJwt(userId)), userId, method: "token" };
  }

  const verifier = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await verifier.auth.getUser(bearer);
  if (error || !data.user) return null;
  return { supabase: clientFor(bearer), userId: data.user.id, method: "oauth" };
}
