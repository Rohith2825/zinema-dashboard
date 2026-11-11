import { authenticate } from "@/lib/mcp/auth";
import { TOOLS, ToolError } from "@/lib/mcp/tools";
import { SITE_URL } from "@/lib/site";

/**
 * Zinema OS MCP server — Streamable HTTP, stateless (one JSON response per POST).
 * Connect any MCP client (Claude, Claude Code, ChatGPT, Cursor…) to  {site}/api/mcp
 */

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};
const INSTRUCTIONS = `Zinema OS is Zinema Music's song pipeline: lyrics → music → master_qc → distribution → video → promo → posting → live.
Start with whoami. Songs are addressed by code (TAM-0007). get_song returns the ids you need for formats, checklist items and file versions.
Rules the server enforces: makers submit files, a different person (checker/approver) reviews them, only approvers advance a stage, and every song needs 3 carousels + 3 verticals. If a tool says you lack permission, tell the user rather than trying another route.
Files live in Google Drive: use save_to_drive to file anything you produce into the song's folder. Dates are India time.`;

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

function unauthorized() {
  return Response.json(fail(null, -32001, "Sign in to Zinema OS to use this server."), {
    status: 401,
    headers: { ...CORS, "WWW-Authenticate": `Bearer resource_metadata="${SITE_URL}/.well-known/oauth-protected-resource"` },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
// No server-initiated stream and no sessions to end.
export function GET() {
  return new Response("Zinema OS MCP server. POST JSON-RPC here.", { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}
export function DELETE() {
  return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(fail(null, -32700, "Invalid JSON."), { status: 400, headers: CORS });
  }
  const messages = (Array.isArray(body) ? body : [body]) as Rpc[];
  const replies: unknown[] = [];

  for (const msg of messages) {
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      replies.push(fail((msg as Rpc)?.id, -32600, "Invalid request."));
      continue;
    }
    if (msg.id === undefined || msg.id === null) continue; // notification: nothing to send back

    switch (msg.method) {
      case "initialize": {
        const asked = String(msg.params?.protocolVersion ?? "");
        replies.push(
          ok(msg.id, {
            protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "zinema-os", title: "Zinema OS", version: "1.0.0" },
            instructions: INSTRUCTIONS,
          }),
        );
        break;
      }
      case "ping":
        replies.push(ok(msg.id, {}));
        break;
      case "tools/list":
        replies.push(
          ok(msg.id, {
            tools: TOOLS.map((t) => ({
              name: t.name,
              title: t.title,
              description: t.description,
              inputSchema: t.inputSchema,
              annotations: { title: t.title, readOnlyHint: Boolean(t.readOnly), openWorldHint: false },
            })),
          }),
        );
        break;
      case "tools/call": {
        const tool = TOOLS.find((t) => t.name === msg.params?.name);
        if (!tool) {
          replies.push(fail(msg.id, -32602, `Unknown tool: ${String(msg.params?.name)}`));
          break;
        }
        try {
          const result = await tool.run(auth, (msg.params?.arguments as Record<string, unknown>) ?? {});
          replies.push(ok(msg.id, { content: [{ type: "text", text: JSON.stringify(result, null, 1) }] }));
        } catch (e) {
          const message = e instanceof ToolError ? e.message : `Something went wrong in ${tool.name}: ${e instanceof Error ? e.message : "unknown error"}`;
          replies.push(ok(msg.id, { content: [{ type: "text", text: message }], isError: true }));
        }
        break;
      }
      case "resources/list":
        replies.push(ok(msg.id, { resources: [] }));
        break;
      case "prompts/list":
        replies.push(ok(msg.id, { prompts: [] }));
        break;
      default:
        replies.push(fail(msg.id, -32601, `Method not found: ${msg.method}`));
    }
  }

  if (replies.length === 0) return new Response(null, { status: 202, headers: CORS });
  return Response.json(Array.isArray(body) ? replies : replies[0], { headers: CORS });
}
