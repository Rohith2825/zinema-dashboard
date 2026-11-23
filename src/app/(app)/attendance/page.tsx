import { Suspense } from "react";
import type { Metadata } from "next";
import { checkIn, checkOut, saveDayNote } from "@/app/actions";
import { AttendanceSwitch } from "@/components/attendance-switch";
import { ActionForm, Submit } from "@/components/action-form";
import { ListSkeleton } from "@/components/skeletons";
import { Avatar, Badge, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/session";
import { TZ, fmtDate, shortName, type Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  return (
    <Suspense fallback={<ListSkeleton label="Loading attendance" rows={5} />}>
      <Attendance searchParams={searchParams} />
    </Suspense>
  );
}

type Row = { id: string; user_id: string; kind: "check_in" | "check_out"; day: string; at: string; note: string | null };
const time = (d: string) => fmtDate(d, { hour: "2-digit", minute: "2-digit" });
const dayLabel = (d: string) => fmtDate(`${d}T12:00:00+05:30`, { weekday: "short", day: "numeric", month: "short" });

async function Attendance({ searchParams }: Pick<PageProps<"/attendance">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today ? sp.day : today;
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 30);
  const since = from.toISOString().slice(0, 10);

  const cols = "id, user_id, kind, day, at, note";
  const [mineR, dayR, membersR, peopleR] = await Promise.all([
    s.supabase.from("attendance").select(cols).eq("user_id", s.user.id).gte("day", since).order("at", { ascending: false }),
    s.isOwner ? s.supabase.from("attendance").select(cols).eq("day", day).order("at") : Promise.resolve({ data: [] }),
    s.isOwner ? s.supabase.from("attendance_members").select("user_id") : Promise.resolve({ data: [] }),
    s.isOwner ? s.supabase.from("profiles").select("id, full_name, nickname, handle, bio, email, is_org_admin").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const mine = (mineR.data ?? []) as Row[];
  const dayRows = (dayR.data ?? []) as Row[];
  const people = (peopleR.data ?? []) as Profile[];
  const expected = new Set((membersR.data ?? []).map((m) => m.user_id as string));
  const checkedIn = mine.find((r) => r.day === today && r.kind === "check_in");
  const checkedOut = mine.find((r) => r.day === today && r.kind === "check_out");
  // The register lists everyone who is expected, plus anyone else who checked in that day.
  const present = new Set(dayRows.filter((r) => r.kind === "check_in").map((r) => r.user_id));
  const listed = people.filter((p) => expected.has(p.id) || present.has(p.id));

  return (
    <>
      <PageTitle title="Attendance" sub="Check in with what you plan to do today. Check out when you finish." />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-8">
          {/* My day */}
          <section className="card p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Today · {fmtDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}</p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {checkedOut ? "Checked out. See you tomorrow" : checkedIn ? `Checked in at ${time(checkedIn.at)}` : "Check in to start your day"}
                </h2>
              </div>
              <ol className="flex items-center gap-2 text-xs font-medium">
                <li className={`rounded-full px-3 py-1.5 ${checkedIn ? "bg-emerald-500/15 text-emerald-800" : "bg-brand-500 text-black"}`}>{checkedIn ? `✓ In · ${time(checkedIn.at)}` : "1 · Check in"}</li>
                <li className={`rounded-full px-3 py-1.5 ${checkedOut ? "bg-emerald-500/15 text-emerald-800" : checkedIn ? "bg-[#0d0d10] text-white" : "bg-black/[0.05] text-muted"}`}>{checkedOut ? `✓ Out · ${time(checkedOut.at)}` : "2 · Check out"}</li>
              </ol>
            </div>

            {!checkedIn && (
              <ActionForm action={checkIn} className="mt-5 space-y-3">
                <label className="label" htmlFor="plan">What will you work on today?</label>
                <textarea id="plan" name="note" required rows={4} maxLength={2000} placeholder={"One task per line, for example:\nFinish the lyric video for TAM-0007\nCheck Hindi artwork"} className="input" />
                <Submit>Check in</Submit>
              </ActionForm>
            )}

            {checkedIn && (
              <div className="mt-5 space-y-5">
                <ActionForm action={saveDayNote} className="space-y-2">
                  <input type="hidden" name="kind" value="check_in" />
                  <label className="label" htmlFor="plan">Today&apos;s tasks</label>
                  <textarea id="plan" name="note" required rows={4} maxLength={2000} defaultValue={checkedIn.note ?? ""} className="input" />
                  <Submit className="btn-ghost">Save changes</Submit>
                </ActionForm>

                {!checkedOut ? (
                  <ActionForm action={checkOut} className="space-y-2 border-t border-black/[0.06] pt-5">
                    <label className="label" htmlFor="done">What got done? (optional)</label>
                    <textarea id="done" name="note" rows={3} maxLength={2000} placeholder="A line or two is enough." className="input" />
                    <Submit className="btn-dark">Check out</Submit>
                  </ActionForm>
                ) : (
                  <ActionForm action={saveDayNote} className="space-y-2 border-t border-black/[0.06] pt-5">
                    <input type="hidden" name="kind" value="check_out" />
                    <label className="label" htmlFor="done">What got done</label>
                    <textarea id="done" name="note" rows={3} maxLength={2000} defaultValue={checkedOut.note ?? ""} className="input" />
                    <Submit className="btn-ghost">Save changes</Submit>
                  </ActionForm>
                )}
              </div>
            )}
          </section>

          {/* Owners: the day's register */}
          {s.isOwner && (
            <section className="card p-5 md:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Register <Badge tone="violet">owners only</Badge></p>
                  <h2 className="mt-1 text-lg font-semibold">{present.size} checked in · {dayLabel(day)}</h2>
                </div>
                <form action="/attendance" className="flex w-full gap-2 sm:w-auto">
                  <input type="date" name="day" defaultValue={day} max={today} className="input w-44" aria-label="Day" />
                  <button className="btn-ghost">Show</button>
                </form>
              </div>
              <ul className="mt-5 divide-y divide-black/[0.06]">
                {listed.map((p) => {
                  const cin = dayRows.find((r) => r.user_id === p.id && r.kind === "check_in");
                  const cout = dayRows.find((r) => r.user_id === p.id && r.kind === "check_out");
                  return (
                    <li key={p.id} className="grid grid-cols-[38px_minmax(0,1fr)] gap-x-3 gap-y-1 py-3.5">
                      <Avatar name={p.full_name} email={p.email} size={38} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-sm font-medium">{shortName(p)}</p>
                          <Badge tone={cin ? "green" : day === today ? "amber" : "red"}>{cin ? "Present" : day === today ? "Not yet" : "Absent"}</Badge>
                          {cin && <span className="font-mono text-xs text-muted">{time(cin.at)} → {cout ? time(cout.at) : "…"}</span>}
                        </div>
                        {cin?.note && <p className="mt-1.5 whitespace-pre-line break-words text-sm text-zinc-700">{cin.note}</p>}
                        {cout?.note && <p className="mt-1.5 whitespace-pre-line break-words text-sm text-zinc-700"><span className="text-xs font-medium text-emerald-700">Done: </span>{cout.note}</p>}
                      </div>
                    </li>
                  );
                })}
                {listed.length === 0 && <li className="py-6 text-center text-sm text-muted">Nobody has checked in on this day.</li>}
              </ul>
            </section>
          )}

          {/* My history */}
          <section className="card p-5 md:p-7">
            <p className="eyebrow">My last 30 days</p>
            <ul className="mt-4 divide-y divide-black/[0.06] text-sm">
              {[...new Set(mine.map((r) => r.day))].map((d) => {
                const a = mine.find((r) => r.day === d && r.kind === "check_in");
                const b = mine.find((r) => r.day === d && r.kind === "check_out");
                return (
                  <li key={d} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{dayLabel(d)}</span>
                      <span className="font-mono text-xs">{a ? time(a.at) : "—"} → {b ? time(b.at) : "—"}</span>
                    </div>
                    {a?.note && <p className="mt-1 whitespace-pre-line break-words text-xs text-zinc-600">{a.note}</p>}
                    {b?.note && <p className="mt-1 whitespace-pre-line break-words text-xs text-zinc-600"><span className="font-medium text-emerald-700">Done: </span>{b.note}</p>}
                  </li>
                );
              })}
              {mine.length === 0 && <li className="py-4 text-muted">Nothing yet.</li>}
            </ul>
          </section>
        </div>

        {/* Owners: who is expected */}
        {s.isOwner && (
          <section className="card p-5 md:p-6">
            <p className="eyebrow">Who is expected every day</p>
            <p className="mt-1 text-xs text-muted">Anyone on the team can check in. People switched on here show as “Not yet” or “Absent” in the register when they haven&apos;t. {expected.size} of {people.length} switched on.</p>
            <ul className="mt-4 space-y-2">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Avatar name={p.full_name} email={p.email} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{shortName(p)}</p>
                    <p className="truncate text-xs text-muted">{p.email}</p>
                  </div>
                  <AttendanceSwitch userId={p.id} name={shortName(p)} on={expected.has(p.id)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
