import { Suspense } from "react";
import type { Metadata } from "next";
import { revokeMcpToken } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { ListSkeleton } from "@/components/skeletons";
import { CopyBox, TokenForm } from "@/components/token-form";
import { Badge, PageTitle } from "@/components/ui";
import { driveIdentity, driveMode, driveStatus } from "@/lib/google-drive";
import { tokensEnabled } from "@/lib/mcp/auth";
import { TOOLS } from "@/lib/mcp/tools";
import { getSession } from "@/lib/session";
import { SITE_URL, folderUrl } from "@/lib/site";
import { fmtDate } from "@/lib/types";

export const metadata: Metadata = { title: "Connect AI" };

export default function ConnectPage() {
  return (
    <Suspense fallback={<ListSkeleton label="Loading connections" rows={4} />}>
      <Connect />
    </Suspense>
  );
}

async function Connect() {
  const s = await getSession();
  const [{ data: tokens }, drive] = await Promise.all([
    s.supabase.from("mcp_tokens").select("id, name, prefix, created_at, last_used_at").is("revoked_at", null).order("created_at", { ascending: false }),
    s.isAdmin ? driveStatus() : Promise.resolve(null),
  ]);
  const url = `${SITE_URL}/api/mcp`;
  const read = TOOLS.filter((t) => t.readOnly);
  const write = TOOLS.filter((t) => !t.readOnly);

  return (
    <>
      <PageTitle
        title="Connect your AI"
        sub="Zinema OS is also an MCP server. Plug in Claude or ChatGPT and it can read the pipeline, move work forward and file what it makes into Google Drive, with exactly your permissions."
      />

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-8">
          <section className="card p-7">
            <p className="eyebrow">Server address</p>
            <div className="mt-3"><CopyBox value={url} label="Copy URL" /></div>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ["Claude", "Settings → Connectors → Add custom connector. Paste the address, connect, and sign in with your Zinema Google account."],
                ["ChatGPT", "Settings → Apps & Connectors → Advanced → turn on Developer mode → Create. Paste the address, keep OAuth, and sign in."],
                ["Claude Code & others", `claude mcp add --transport http zinema-os ${url}`],
              ].map(([t, d], i) => (
                <li key={t} className="tile p-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0d0d10] text-xs font-semibold text-white">{i + 1}</span>
                  <p className="mt-3 text-sm font-semibold">{t}</p>
                  <p className={`mt-1 break-words text-xs text-muted ${i === 2 ? "font-mono" : ""}`}>{d}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">What your AI can do</p>
                <h2 className="mt-1 text-lg font-semibold">{TOOLS.length} tools, your permissions</h2>
              </div>
              <Badge tone="green">role-aware</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">Anything done through AI is checked against your page roles and shows up in the activity log as “via AI”. It can never approve your own work for you.</p>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              {[["Reads", read], ["Actions", write]].map(([label, list]) => (
                <div key={label as string}>
                  <p className="label">{label as string}</p>
                  <ul className="space-y-2">
                    {(list as typeof TOOLS).map((t) => (
                      <li key={t.name} className="text-sm">
                        <code className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-[11px]">{t.name}</code>
                        <span className="ml-2 text-xs text-muted">{t.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="card p-6">
            <p className="eyebrow">Personal tokens</p>
            <p className="mb-4 mt-2 text-sm text-muted">For tools that can&apos;t show a sign-in window. A token acts as you — keep it private and revoke it when you stop using it.</p>
            {tokensEnabled() ? <TokenForm /> : <p className="well p-4 text-xs text-muted">Tokens are switched off until an admin adds <code>SUPABASE_JWT_SECRET</code>. Sign-in based connections work without it.</p>}
            <ul className="mt-5 space-y-2">
              {(tokens ?? []).map((t) => (
                <li key={t.id} className="tile flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="font-mono text-[11px] text-muted">{t.prefix}… · {t.last_used_at ? `used ${fmtDate(t.last_used_at)}` : "never used"}</p>
                  </div>
                  <ActionForm action={revokeMcpToken} confirm={`Revoke “${t.name}”?`}>
                    <input type="hidden" name="id" value={t.id} />
                    <Submit className="btn-danger">Revoke</Submit>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </section>

          {s.isAdmin && drive && (
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Google Drive</p>
                <Badge tone={drive.ok ? "green" : "amber"}>{drive.ok ? "Connected" : "Needs setup"}</Badge>
              </div>
              {drive.ok ? (
                <p className="mt-3 text-sm text-muted">
                  Filing into <a className="font-medium text-brand-700 underline" href={folderUrl(process.env.GOOGLE_DRIVE_ROOT_ID!)} target="_blank" rel="noreferrer">{drive.rootName}</a> as {driveIdentity()}
                  {driveMode() === "service_account" ? " (service account)" : ""}.
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted">{drive.message}. Setup steps are in docs/SETUP.md in the repository.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
