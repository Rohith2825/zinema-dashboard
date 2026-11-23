import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { markAllRead } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, Empty, PageTitle, VERSION_LABEL } from "@/components/ui";
import { getSession } from "@/lib/session";
import { buildStandup } from "@/lib/standup";
import { KIND_LABEL, fmtDate, type DeliverableKind } from "@/lib/types";

export default function InboxPage() {
  return (
    <Suspense fallback={<ListSkeleton label="Loading inbox" />}>
      <Inbox />
    </Suspense>
  );
}

async function Inbox() {
  const s = await getSession();
  const [standup, { data: notes }, { data: toCheck }, { data: mine }] = await Promise.all([
    buildStandup(s.supabase),
    s.supabase.from("notifications").select("id, kind, body, read_at, created_at, song:songs(code, title)").order("created_at", { ascending: false }).limit(50),
    // Files waiting for a check on pages where I can check (excluding my own submissions)
    s.supabase
      .from("deliverable_versions")
      .select("id, version, status, submitted_by, submitted_at, deliverable:deliverables(kind, slot, checker_id, song:songs(code, title, page_id))")
      .eq("status", "submitted")
      .neq("submitted_by", s.user.id)
      .order("submitted_at"),
    // My submissions that need changes
    s.supabase
      .from("deliverable_versions")
      .select("id, version, status, deliverable:deliverables(kind, slot, song:songs(code, title))")
      .eq("submitted_by", s.user.id)
      .eq("status", "changes_requested"),
  ]);

  type V = { id: string; version: number; status: string; submitted_at?: string; deliverable: { kind: DeliverableKind; slot: number; checker_id?: string | null; song: { code: string; title: string; page_id?: string } } };
  const checks = ((toCheck ?? []) as unknown as V[]).filter((v) => v.deliverable?.song?.page_id && s.canCheck(v.deliverable.song.page_id));
  const fixes = (mine ?? []) as unknown as V[];
  const item = (v: V) => `${KIND_LABEL[v.deliverable.kind]}${["carousel", "vertical"].includes(v.deliverable.kind) ? ` ${v.deliverable.slot}` : ""} v${v.version}`;

  return (
    <>
      <PageTitle title="Inbox" sub="What's waiting on you." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-medium">To check <Badge tone="blue">{checks.length}</Badge></h2>
          {checks.length ? (
            <ul className="space-y-2 text-sm">
              {checks.map((v) => (
                <li key={v.id}>
                  <Link href={`/songs/${v.deliverable.song.code}`} className="hover:underline">
                    <span className="font-mono text-xs text-muted">{v.deliverable.song.code}</span> {v.deliverable.song.title} — {item(v)}
                  </Link>
                  {v.deliverable.checker_id === s.user.id && <> <Badge tone="violet">assigned to you</Badge></>}
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing waiting for a check.</Empty>}
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-medium">Changes requested on your work <Badge tone="amber">{fixes.length}</Badge></h2>
          {fixes.length ? (
            <ul className="space-y-2 text-sm">
              {fixes.map((v) => (
                <li key={v.id}>
                  <Link href={`/songs/${v.deliverable.song.code}`} className="hover:underline">
                    <span className="font-mono text-xs text-muted">{v.deliverable.song.code}</span> {v.deliverable.song.title} — {item(v)} · {VERSION_LABEL[v.status]}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing to fix.</Empty>}
        </section>

        <section className="card p-4 lg:col-span-2">
          <h2 className="font-medium">Today&apos;s stand-up <Badge tone={standup.total ? "amber" : "green"}>{standup.total}</Badge></h2>
          <p className="mb-3 text-xs text-muted">Across your pages: what is close to release, waiting, late or blocked.</p>
          {standup.total === 0 && <Empty>Nothing is waiting, late or blocked. Nice.</Empty>}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            {standup.sections.filter((sec) => sec.items.length).map((sec) => (
              <div key={sec.key} className="min-w-0">
                <p className="eyebrow">{sec.label} · {sec.items.length}</p>
                <ul className="mt-1.5 space-y-2 text-sm">
                  {sec.items.slice(0, 8).map((it, i) => (
                    <li key={i} className="min-w-0">
                      {it.code ? (
                        <Link href={`/songs/${it.code}`} className="hover:underline"><span className="font-mono text-xs text-muted">{it.code}</span> {it.title}</Link>
                      ) : <span>{it.title}</span>}
                      <span className="text-xs text-muted"> · {it.page}</span>
                      <p className="text-xs text-zinc-600">{it.text}{it.who ? ` · ${it.who}` : ""}</p>
                    </li>
                  ))}
                  {sec.items.length > 8 && <li className="text-xs text-muted">and {sec.items.length - 8} more</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Notifications</h2>
            {s.unread > 0 && (
              <ActionForm action={markAllRead}>
                <Submit className="btn-ghost">Mark all read</Submit>
              </ActionForm>
            )}
          </div>
          {(notes ?? []).length ? (
            <ul className="hairline divide-y divide-black/[0.06] text-sm">
              {(notes ?? []).map((n) => {
                const song = n.song as unknown as { code: string; title: string } | null;
                return (
                  <li key={n.id} className={`flex justify-between gap-3 py-2 ${n.read_at ? "text-muted" : ""}`}>
                    <span>
                      {!n.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" />}
                      {n.kind === "mention" ? "You were tagged: " : n.kind === "task_assigned" ? "New task: " : n.kind === "team_message" ? "Message to the team: " : ""}
                      {song ? <Link href={`/songs/${song.code}`} className="hover:underline">{n.body}</Link> : n.body}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{fmtDate(n.created_at, { day: "numeric", month: "short" })}</span>
                  </li>
                );
              })}
            </ul>
          ) : <Empty>No notifications yet.</Empty>}
        </section>
      </div>
    </>
  );
}
