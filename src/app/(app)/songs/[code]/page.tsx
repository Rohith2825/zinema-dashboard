import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addChecklistItem, addComment, addContentSlot, addCredit, addDistribution, addFormat, advanceSong, assignDeliverable, createTask,
  generateContentPlan, markSlotLive, removeContentSlot, removeCredit, removeFormat, reviewVersion, saveRights, submitVersion,
  toggleChecklistItem, updateFormat, updateSong,
} from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, Empty, VERSION_LABEL, VERSION_TONE, pageShort, type Tone } from "@/components/ui";
import { getSession, type Session } from "@/lib/session";
import {
  FORMAT_STATUSES, KIND_LABEL, STAGES, TZ, fmtDate, formatStatusLabel, shortName, stageLabel,
  type DeliverableKind, type FormatStatus, type Profile, type StageKey,
} from "@/lib/types";

export default function SongPage({ params }: PageProps<"/songs/[code]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading song…</p>}>
      <Song params={params} />
    </Suspense>
  );
}

type Version = {
  id: string; version: number; status: string; drive_url: string; note: string | null; submitted_at: string; submitted_by: string;
  reviews: { decision: string; comments: string | null; reviewer_id: string; created_at: string }[];
  audit_runs: { verdict: string; skill: string; report_md: string | null; created_at: string }[];
};
type Deliverable = {
  id: string; stage: StageKey; kind: DeliverableKind; slot: number; required: boolean;
  assignee_id: string | null; checker_id: string | null; due_at: string | null; deliverable_versions: Version[];
};
type FormatType = { kind: DeliverableKind; label: string; stage: StageKey; position: number };
type Format = {
  id: string; deliverable_id: string | null; kind: DeliverableKind; label: string; status: FormatStatus; mandatory: boolean;
  owner_id: string | null; planned_at: string | null; went_live_at: string | null; live_url: string | null;
  drive_folder_url: string | null; notes: string | null;
  format_checklist: { id: string; label: string; position: number; done_at: string | null; done_by: string | null }[];
};

const FORMAT_TONE: Record<FormatStatus, Tone> = {
  planned: "zinc", in_progress: "amber", in_review: "blue", approved: "green", live: "violet", dropped: "zinc",
};
const ymdIST = (d: string | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d)) : "");

async function Song({ params }: Pick<PageProps<"/songs/[code]">, "params">) {
  const { code } = await params;
  const s = await getSession();
  const db = s.supabase;

  const { data: song } = await db
    .from("songs")
    .select("id, code, title, page_id, current_stage, planned_release_date, metadata, page:pages(name, slug)")
    .eq("code", decodeURIComponent(code).toUpperCase())
    .maybeSingle();
  if (!song) notFound();

  const [delivR, creditsR, distR, slotsR, tasksR, commentsR, activityR, peopleR, rightsR, formatsR, typesR] = await Promise.all([
    db.from("deliverables")
      .select("id, stage, kind, slot, required, assignee_id, checker_id, due_at, deliverable_versions(id, version, status, drive_url, note, submitted_at, submitted_by, reviews(decision, comments, reviewer_id, created_at), audit_runs(verdict, skill, report_md, created_at))")
      .eq("song_id", song.id).order("kind").order("slot"),
    db.from("song_credits").select("id, role, name, as_credited").eq("song_id", song.id).order("role"),
    db.from("distribution_records").select("id, distributor, legacy, isrc, upc, catalog_number, release_date, dsp_status, source").eq("song_id", song.id),
    db.from("content_slots").select("id, label, planned_at, went_live_at, live_url, deliverable_id").eq("song_id", song.id).order("planned_at"),
    db.from("tasks").select("id, title, status, assignee_id, due_at").eq("song_id", song.id).order("created_at"),
    db.from("comments").select("id, body, author_id, created_at, via").eq("song_id", song.id).order("created_at"),
    db.from("activity_log").select("id, at, actor_id, entity, action, diff").eq("song_id", song.id).order("at", { ascending: false }).limit(15),
    db.from("profiles").select("id, full_name, email, is_org_admin").order("full_name"),
    s.isOwner ? db.from("song_rights").select("splits, notes, contract_drive_url, updated_at").eq("song_id", song.id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("song_formats")
      .select("id, deliverable_id, kind, label, status, mandatory, owner_id, planned_at, went_live_at, live_url, drive_folder_url, notes, format_checklist(id, label, position, done_at, done_by)")
      .eq("song_id", song.id).order("created_at"),
    db.from("format_types").select("kind, label, stage, position").order("position"),
  ]);

  const people = (peopleR.data ?? []) as Profile[];
  const who = (id: string | null) => shortName(people.find((p) => p.id === id));
  const allDeliverables = (delivR.data ?? []) as unknown as Deliverable[];
  const types = (typesR.data ?? []) as FormatType[];
  const typePos = (k: string) => types.find((t) => t.kind === k)?.position ?? 999;
  const formats = ((formatsR.data ?? []) as unknown as Format[]).sort(
    (a, b) => Number(a.status === "dropped") - Number(b.status === "dropped") || typePos(a.kind) - typePos(b.kind) || a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  const formatDeliverables = new Set(formats.map((f) => f.deliverable_id).filter(Boolean));
  // Files that belong to a format are shown inside that format, not in the stage list.
  const deliverables = allDeliverables.filter((d) => !formatDeliverables.has(d.id));
  const meta = (song.metadata ?? {}) as { language?: string; imported?: boolean; style?: string };
  const page = song.page as unknown as { name: string; slug: string } | null;
  const canWork = s.canWork(song.page_id);
  const canCheck = s.canCheck(song.page_id);
  const canApprove = s.canApprove(song.page_id);
  const stageIdx = STAGES.findIndex((x) => x.key === song.current_stage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/board${page ? `?page=${page.slug}` : ""}`} className="text-sm text-zinc-500 hover:text-zinc-800">← Board</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-zinc-500">{song.code}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{song.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{pageShort(page?.name)}</Badge>
              {meta.language && <Badge>{meta.language}</Badge>}
              {meta.style && <Badge>{meta.style}</Badge>}
              <Badge tone="violet">{stageLabel(song.current_stage)}</Badge>
              {song.planned_release_date && <Badge tone="amber">Release {fmtDate(song.planned_release_date)}</Badge>}
            </div>
          </div>
          {canApprove && song.current_stage !== "live" && (
            <ActionForm action={advanceSong} className="text-right">
              <input type="hidden" name="song_id" value={song.id} />
              <Submit>Approve stage → {stageLabel(STAGES[stageIdx + 1]?.key ?? "live")}</Submit>
            </ActionForm>
          )}
        </div>

        {/* Stage timeline */}
        <ol className="mt-5 flex flex-wrap gap-1">
          {STAGES.map((st, i) => (
            <li
              key={st.key}
              className={`rounded-full px-2.5 py-1 text-xs ${
                i < stageIdx ? "bg-emerald-100 text-emerald-800" : i === stageIdx ? "bg-brand-500 text-black" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {i < stageIdx ? "✓ " : ""}{st.label}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Deliverables by stage */}
        <div className="space-y-3">
          {meta.imported && deliverables.length === 0 ? (
            <Empty>Released before Zinema OS — no tracked files for this song.</Empty>
          ) : (
            STAGES.filter((st) => deliverables.some((d) => d.stage === st.key)).map((st) => {
              const items = deliverables.filter((d) => d.stage === st.key);
              return (
                <details key={st.key} open={st.key === song.current_stage} className="card">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                    <span className="font-medium">{st.label}</span>
                    <span className="text-xs text-zinc-500">
                      {items.filter((d) => d.deliverable_versions.some((v) => v.status === "approved")).length}/{items.length} approved
                    </span>
                  </summary>
                  <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                    {items.map((d) => (
                      <DeliverableRow key={d.id} d={d} s={s} people={people} canWork={canWork} canCheck={canCheck} who={who} />
                    ))}
                  </ul>
                </details>
              );
            })
          )}

          <FormatsSection
            songId={song.id} formats={formats} types={types} deliverables={allDeliverables} people={people}
            s={s} canWork={canWork} canCheck={canCheck} who={who}
          />

          {/* Comments */}
          <section className="card p-4">
            <h2 className="mb-3 font-medium">Discussion</h2>
            <ul className="mb-3 space-y-3">
              {(commentsR.data ?? []).map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium">{who(c.author_id)}</span>
                  <span className="ml-2 text-xs text-zinc-400">{fmtDate(c.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{c.via === "agent" ? " · via Claude" : ""}</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-zinc-700">{c.body}</p>
                </li>
              ))}
              {(commentsR.data ?? []).length === 0 && <li className="text-sm text-zinc-500">No comments yet.</li>}
            </ul>
            <ActionForm action={addComment} resetOnSuccess className="space-y-2">
              <input type="hidden" name="song_id" value={song.id} />
              <textarea name="body" rows={2} className="input" placeholder={`Comment… tag people with @${people[0]?.email.split("@")[0] ?? "name"}`} />
              <Submit>Post</Submit>
            </ActionForm>
          </section>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 font-medium">Details</h2>
            <ActionForm action={updateSong} className="space-y-3">
              <input type="hidden" name="song_id" value={song.id} />
              <div>
                <label className="label">Title</label>
                <input name="title" defaultValue={song.title} className="input" disabled={!canWork} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Language</label>
                  <input name="language" defaultValue={meta.language ?? ""} className="input" disabled={!canWork} />
                </div>
                <div>
                  <label className="label">Planned release</label>
                  <input name="planned_release_date" type="date" defaultValue={song.planned_release_date ?? ""} className="input" disabled={!canWork} />
                </div>
              </div>
              {canWork && <Submit className="btn-ghost">Save</Submit>}
            </ActionForm>
          </section>

          {/* Distribution */}
          <section className="card p-4">
            <h2 className="mb-3 font-medium">Distribution</h2>
            {(distR.data ?? []).map((r) => (
              <dl key={r.id} className="mb-3 grid grid-cols-[90px_1fr] gap-y-1 text-sm">
                <dt className="text-zinc-500">Distributor</dt>
                <dd>{r.distributor} {r.legacy && <Badge>legacy</Badge>}</dd>
                <dt className="text-zinc-500">ISRC</dt><dd className="font-mono">{r.isrc}</dd>
                {r.upc && (<><dt className="text-zinc-500">UPC</dt><dd className="font-mono">{r.upc}</dd></>)}
                {r.catalog_number && (<><dt className="text-zinc-500">Catalog no.</dt><dd className="font-mono">{r.catalog_number}</dd></>)}
                <dt className="text-zinc-500">Release</dt><dd>{fmtDate(r.release_date)}</dd>
                {r.dsp_status && (<><dt className="text-zinc-500">Status</dt><dd>{r.dsp_status}</dd></>)}
              </dl>
            ))}
            {canWork && (
              <details open={(distR.data ?? []).length === 0}>
                <summary className="cursor-pointer text-sm text-brand-700">+ Record PDL upload</summary>
                <ActionForm action={addDistribution} className="mt-3 space-y-2" resetOnSuccess>
                  <input type="hidden" name="song_id" value={song.id} />
                  <input type="hidden" name="distributor" value="PDL" />
                  <input name="isrc" required placeholder="ISRC (e.g. INP2X2501681)" className="input font-mono" />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="upc" placeholder="UPC" className="input font-mono" />
                    <input name="catalog_number" placeholder="Catalog no." className="input font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="release_date" type="date" className="input" />
                    <input name="dsp_status" placeholder="Cosmos status" className="input" />
                  </div>
                  <input name="proof_url" placeholder="Cosmos screenshot (Drive link)" className="input" />
                  <Submit>Save</Submit>
                </ActionForm>
              </details>
            )}
          </section>

          {/* Credits */}
          <section className="card p-4">
            <h2 className="mb-3 font-medium">Credits</h2>
            <ul className="mb-3 space-y-1 text-sm">
              {(creditsR.data ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span><span className="text-zinc-500">{c.role}:</span> {c.name}</span>
                  {canWork && (
                    <ActionForm action={removeCredit}>
                      <input type="hidden" name="id" value={c.id} />
                      <Submit className="btn-danger">Remove</Submit>
                    </ActionForm>
                  )}
                </li>
              ))}
              {(creditsR.data ?? []).length === 0 && <li className="text-zinc-500">No credits yet.</li>}
            </ul>
            {canWork && (
              <ActionForm action={addCredit} resetOnSuccess className="flex gap-2">
                <input type="hidden" name="song_id" value={song.id} />
                <select name="role" className="input w-32" defaultValue="Singer">
                  {["Singer", "Lyricist", "Composer", "Music producer", "Mix engineer", "Mastering engineer", "Featuring"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <input name="name" placeholder="Name" className="input" required />
                <Submit className="btn-ghost">Add</Submit>
              </ActionForm>
            )}
          </section>

          {/* Rights — owners only */}
          {s.isOwner && (
            <section className="card border-brand-200 p-4">
              <h2 className="mb-1 font-medium">Royalty splits <Badge tone="violet">owners only</Badge></h2>
              <p className="mb-3 text-xs text-zinc-500">One per line: Party, role, master|publishing, share %. Each type must total 100.</p>
              <ActionForm action={saveRights} className="space-y-2">
                <input type="hidden" name="song_id" value={song.id} />
                <textarea
                  name="splits"
                  rows={4}
                  className="input font-mono text-xs"
                  defaultValue={((rightsR.data?.splits ?? []) as { party: string; role: string; type: string; share_pct: number }[])
                    .map((x) => `${x.party}, ${x.role}, ${x.type}, ${x.share_pct}`).join("\n")}
                  placeholder={"Zinema Music, label, master, 100\nKavi, lyricist, publishing, 50\nRavi, composer, publishing, 50"}
                />
                <input name="contract_drive_url" defaultValue={rightsR.data?.contract_drive_url ?? ""} placeholder="Contract (Drive link)" className="input" />
                <textarea name="notes" rows={2} defaultValue={rightsR.data?.notes ?? ""} placeholder="Contract notes" className="input" />
                <Submit>Save rights</Submit>
              </ActionForm>
            </section>
          )}

          {/* Content plan */}
          <section className="card p-4">
            <h2 className="mb-3 font-medium">Content plan</h2>
            <ul className="mb-3 space-y-2 text-sm">
              {(slotsR.data ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="text-zinc-500">{fmtDate(c.planned_at, { day: "numeric", month: "short" })}</span> · {c.label}
                    {c.went_live_at && <> <Badge tone="green">live</Badge></>}
                  </span>
                  {canWork && (
                    <span className="flex gap-1">
                      {!c.went_live_at && (
                        <ActionForm action={markSlotLive}>
                          <input type="hidden" name="id" value={c.id} />
                          <Submit className="btn-ghost !px-2 !py-0.5 text-xs">Mark live</Submit>
                        </ActionForm>
                      )}
                      <ActionForm action={removeContentSlot}>
                        <input type="hidden" name="id" value={c.id} />
                        <Submit className="btn-danger">✕</Submit>
                      </ActionForm>
                    </span>
                  )}
                </li>
              ))}
              {(slotsR.data ?? []).length === 0 && <li className="text-zinc-500">Nothing planned yet.</li>}
            </ul>
            {canWork && (
              <div className="space-y-3">
                {formats.some((f) => f.mandatory && !f.planned_at) && (
                  <ActionForm action={generateContentPlan}>
                    <input type="hidden" name="song_id" value={song.id} />
                    <Submit className="btn-ghost w-full">Plan 3 carousels + 3 verticals around release</Submit>
                  </ActionForm>
                )}
                <ActionForm action={addContentSlot} resetOnSuccess className="flex gap-2">
                  <input type="hidden" name="song_id" value={song.id} />
                  <input type="hidden" name="page_id" value={song.page_id} />
                  <input name="label" placeholder="e.g. Reel teaser" className="input" required />
                  <input name="planned_at" type="date" className="input w-36" required />
                  <Submit className="btn-ghost">Add</Submit>
                </ActionForm>
              </div>
            )}
          </section>

          {/* Tasks */}
          <section className="card p-4">
            <h2 className="mb-3 font-medium">Tasks</h2>
            <ul className="mb-3 space-y-1 text-sm">
              {(tasksR.data ?? []).map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className={t.status === "done" ? "text-zinc-400 line-through" : ""}>{t.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{t.assignee_id ? who(t.assignee_id) : "unassigned"}</span>
                </li>
              ))}
              {(tasksR.data ?? []).length === 0 && <li className="text-zinc-500">No tasks.</li>}
            </ul>
            {canWork && (
              <ActionForm action={createTask} resetOnSuccess className="space-y-2">
                <input type="hidden" name="song_id" value={song.id} />
                <input type="hidden" name="page_id" value={song.page_id} />
                <input name="title" placeholder="New task…" className="input" required />
                <div className="flex gap-2">
                  <select name="assignee_id" className="input" defaultValue="">
                    <option value="">Unassigned</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{shortName(p)}</option>)}
                  </select>
                  <input name="due_at" type="date" className="input w-36" />
                  <Submit className="btn-ghost">Add</Submit>
                </div>
              </ActionForm>
            )}
          </section>

          {/* Activity */}
          <section className="card p-4">
            <h2 className="mb-3 font-medium">Activity</h2>
            <ul className="space-y-1.5 text-xs text-zinc-600">
              {(activityR.data ?? []).map((a) => (
                <li key={a.id}>
                  <span className="text-zinc-400">{fmtDate(a.at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>{" "}
                  {who(a.actor_id)} · {describe(a.entity, a.action, a.diff as Record<string, string> | null)}
                </li>
              ))}
              {(activityR.data ?? []).length === 0 && <li>Nothing yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function describe(entity: string, action: string, diff: Record<string, string> | null) {
  if (entity === "songs" && action === "stage_advanced") return `moved ${stageLabel(diff?.from ?? "")} → ${stageLabel(diff?.to ?? "")}`;
  if (entity === "songs") return "created the song";
  if (entity === "deliverable_versions") return "submitted a file";
  if (entity === "reviews") return diff?.decision === "approve" ? "approved a file" : "reviewed a file";
  if (entity === "distribution_records") return "recorded distribution";
  if (entity === "tasks") return "added a task";
  if (entity === "song_rights") return "updated rights";
  if (entity === "song_formats") return action === "insert" ? "added a format" : "updated a format";
  return `${action} ${entity}`;
}

function DeliverableRow({
  d, s, people, canWork, canCheck, who,
}: {
  d: Deliverable; s: Session; people: Profile[]; canWork: boolean; canCheck: boolean; who: (id: string | null) => string;
}) {
  const versions = [...d.deliverable_versions].sort((a, b) => b.version - a.version);
  const latest = versions[0];
  const lastReview = latest?.reviews.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const audit = latest?.audit_runs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const multi = ["carousel", "vertical"].includes(d.kind);
  const mine = latest?.submitted_by === s.user.id;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{KIND_LABEL[d.kind]}{multi ? ` ${d.slot}` : ""}</span>
          {!d.required && <Badge>optional</Badge>}
          {latest && <Badge tone={VERSION_TONE[latest.status]}>{VERSION_LABEL[latest.status]}</Badge>}
          {audit && <Badge tone={audit.verdict === "pass" ? "green" : audit.verdict === "warn" ? "amber" : "red"}>audit: {audit.verdict}</Badge>}
        </div>
        <span className="text-xs text-zinc-500">
          {d.assignee_id && <>maker {who(d.assignee_id)} · </>}
          {d.checker_id && <>checker {who(d.checker_id)} · </>}
          {d.due_at && <>due {fmtDate(d.due_at, { day: "numeric", month: "short" })}</>}
        </span>
      </div>

      {latest && (
        <p className="mt-1 text-xs text-zinc-600">
          <a href={latest.drive_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">v{latest.version} on Drive</a>
          {" "}by {who(latest.submitted_by)} · {fmtDate(latest.submitted_at, { day: "numeric", month: "short" })}
          {latest.note && <> · “{latest.note}”</>}
        </p>
      )}
      {lastReview?.comments && (
        <p className={`mt-1 rounded px-2 py-1 text-xs ${lastReview.decision === "approve" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {who(lastReview.reviewer_id)}: {lastReview.comments}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {canCheck && latest?.status === "submitted" && !mine && (
          <ActionForm action={reviewVersion} className="flex w-full flex-wrap items-start gap-2">
            <input type="hidden" name="version_id" value={latest.id} />
            <input name="comments" placeholder="Feedback (required if requesting changes)" className="input flex-1" />
            <Submit name="decision" value="approve">Approve</Submit>
            <Submit name="decision" value="request_changes" className="btn-ghost">Request changes</Submit>
          </ActionForm>
        )}
        {canWork && latest?.status !== "approved" && (
          <details className="w-full">
            <summary className="cursor-pointer text-xs text-brand-700">{latest ? "Submit a new version" : "Submit Drive link"}</summary>
            <ActionForm action={submitVersion} resetOnSuccess className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="deliverable_id" value={d.id} />
              <input name="drive_url" required placeholder="https://drive.google.com/…" className="input min-w-0 flex-1" />
              <input name="note" placeholder="Note (optional)" className="input w-40" />
              <Submit>Submit</Submit>
            </ActionForm>
          </details>
        )}
        {canCheck && (
          <details className="w-full">
            <summary className="cursor-pointer text-xs text-zinc-500">Assign</summary>
            <ActionForm action={assignDeliverable} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="deliverable_id" value={d.id} />
              <select name="assignee_id" defaultValue={d.assignee_id ?? ""} className="input w-40">
                <option value="">Maker…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{shortName(p)}</option>)}
              </select>
              <select name="checker_id" defaultValue={d.checker_id ?? ""} className="input w-40">
                <option value="">Checker…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{shortName(p)}</option>)}
              </select>
              <input name="due_at" type="date" defaultValue={d.due_at?.slice(0, 10) ?? ""} className="input w-36" />
              <Submit className="btn-ghost">Save</Submit>
            </ActionForm>
          </details>
        )}
      </div>

      {versions.length > 1 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-zinc-400">Earlier versions</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
            {versions.slice(1).map((v) => (
              <li key={v.id}>
                <a href={v.drive_url} target="_blank" rel="noreferrer" className="underline">v{v.version}</a> · {VERSION_LABEL[v.status]} · {who(v.submitted_by)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function FormatsSection({
  songId, formats, types, deliverables, people, s, canWork, canCheck, who,
}: {
  songId: string; formats: Format[]; types: FormatType[]; deliverables: Deliverable[]; people: Profile[];
  s: Session; canWork: boolean; canCheck: boolean; who: (id: string | null) => string;
}) {
  const active = formats.filter((f) => f.status !== "dropped");
  const live = active.filter((f) => f.status === "live").length;
  return (
    <section className="card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <h2 className="font-medium">Formats</h2>
          <p className="text-xs text-zinc-500">Every version of this song: verticals, carousels, videos, audio — before and after release.</p>
        </div>
        <span className="text-xs text-zinc-500">{live}/{active.length} live</span>
      </header>
      <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
        {formats.map((f) => {
          const done = f.format_checklist.filter((c) => c.done_at).length;
          const total = f.format_checklist.length;
          const d = deliverables.find((x) => x.id === f.deliverable_id);
          return (
            <li key={f.id}>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className={`flex flex-wrap items-center gap-2 ${f.status === "dropped" ? "text-zinc-400 line-through" : ""}`}>
                    <span className="text-sm font-medium">{f.label}</span>
                    {f.label !== KIND_LABEL[f.kind] && !f.label.startsWith(KIND_LABEL[f.kind]) && <Badge>{KIND_LABEL[f.kind]}</Badge>}
                    {f.mandatory && <Badge>required</Badge>}
                    <Badge tone={FORMAT_TONE[f.status]}>{formatStatusLabel(f.status)}</Badge>
                  </span>
                  <span className="text-xs text-zinc-500">
                    {total > 0 && <>{done}/{total} done · </>}
                    {f.owner_id && <>{who(f.owner_id)} · </>}
                    {f.went_live_at ? <>live {fmtDate(f.went_live_at, { day: "numeric", month: "short" })}</> : f.planned_at ? <>planned {fmtDate(f.planned_at, { day: "numeric", month: "short" })}</> : "no date"}
                  </span>
                </summary>
                <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
                  {(f.live_url || f.drive_folder_url) && (
                    <p className="flex flex-wrap gap-3 text-xs">
                      {f.live_url && <a href={f.live_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">Live post ↗</a>}
                      {f.drive_folder_url && <a href={f.drive_folder_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">Drive folder ↗</a>}
                    </p>
                  )}

                  {/* Checklist */}
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Checklist</h3>
                    <ul className="space-y-1">
                      {[...f.format_checklist].sort((a, b) => a.position - b.position).map((c) => (
                        <li key={c.id}>
                          <ActionForm action={toggleChecklistItem} className="flex items-center gap-2 text-sm">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="done" value={c.done_at ? "0" : "1"} />
                            <button
                              type="submit"
                              disabled={!canWork}
                              aria-label={c.done_at ? `Untick ${c.label}` : `Tick ${c.label}`}
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${c.done_at ? "border-brand-500 bg-brand-500 text-black" : "border-zinc-400 bg-white"}`}
                            >
                              {c.done_at ? "✓" : ""}
                            </button>
                            <span className={c.done_at ? "text-zinc-400 line-through" : ""}>{c.label}</span>
                            {c.done_at && <span className="text-[11px] text-zinc-400">{who(c.done_by)} · {fmtDate(c.done_at, { day: "numeric", month: "short" })}</span>}
                          </ActionForm>
                        </li>
                      ))}
                    </ul>
                    {canWork && (
                      <ActionForm action={addChecklistItem} resetOnSuccess className="mt-2 flex gap-2">
                        <input type="hidden" name="format_id" value={f.id} />
                        <input name="label" placeholder="Add a checklist item…" className="input" />
                        <Submit className="btn-ghost">Add</Submit>
                      </ActionForm>
                    )}
                  </div>

                  {/* Files (submit / review via the linked deliverable) */}
                  {d && (
                    <div>
                      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">File</h3>
                      <ul className="card">
                        <DeliverableRow d={d} s={s} people={people} canWork={canWork} canCheck={canCheck} who={who} />
                      </ul>
                    </div>
                  )}

                  {/* Details */}
                  {canWork && (
                    <ActionForm action={updateFormat} className="space-y-2">
                      <input type="hidden" name="format_id" value={f.id} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="label">Name</label>
                          <input name="label" defaultValue={f.label} className="input" />
                        </div>
                        <div>
                          <label className="label">Status</label>
                          <select name="status" defaultValue={f.status} className="input">
                            {FORMAT_STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Owner</label>
                          <select name="owner_id" defaultValue={f.owner_id ?? ""} className="input">
                            <option value="">Nobody yet</option>
                            {people.map((p) => <option key={p.id} value={p.id}>{shortName(p)}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="label">Planned for</label>
                            <input name="planned_at" type="date" defaultValue={ymdIST(f.planned_at)} className="input" />
                          </div>
                          <div>
                            <label className="label">Went live (if Live)</label>
                            <input name="went_live_at" type="date" defaultValue={ymdIST(f.went_live_at)} className="input" />
                          </div>
                        </div>
                        <div>
                          <label className="label">Drive folder</label>
                          <input name="drive_folder_url" defaultValue={f.drive_folder_url ?? ""} placeholder="https://drive.google.com/drive/folders/…" className="input" />
                        </div>
                        <div>
                          <label className="label">Live URL</label>
                          <input name="live_url" defaultValue={f.live_url ?? ""} placeholder="Instagram / YouTube link" className="input" />
                        </div>
                      </div>
                      <div>
                        <label className="label">Notes</label>
                        <textarea name="notes" rows={2} defaultValue={f.notes ?? ""} className="input" />
                      </div>
                      <Submit className="btn-ghost">Save format</Submit>
                    </ActionForm>
                  )}
                  {canWork && !f.mandatory && (
                    <ActionForm action={removeFormat} confirm={`Remove "${f.label}" and its files?`}>
                      <input type="hidden" name="format_id" value={f.id} />
                      <Submit className="btn-danger">Remove format</Submit>
                    </ActionForm>
                  )}
                </div>
              </details>
            </li>
          );
        })}
        {formats.length === 0 && <li className="px-4 py-3 text-sm text-zinc-500">No formats yet.</li>}
      </ul>
      {canWork && (
        <ActionForm action={addFormat} resetOnSuccess className="flex flex-wrap gap-2 border-t border-zinc-100 px-4 py-3">
          <input type="hidden" name="song_id" value={songId} />
          <select name="kind" className="input w-56" defaultValue="lyric_video" required>
            {types.map((t) => <option key={t.kind} value={t.kind}>{t.label}</option>)}
          </select>
          <input name="label" placeholder="Name (optional), e.g. Dance vertical" className="input min-w-0 flex-1" />
          <Submit>+ Add format</Submit>
        </ActionForm>
      )}
    </section>
  );
}
