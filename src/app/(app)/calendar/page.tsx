import { Suspense } from "react";
import { CalendarSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { getSession, pageBySlug } from "@/lib/session";
import { TZ } from "@/lib/types";
import { PageTabs, PageTitle } from "@/components/ui";

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

const KINDS = [
  { key: "song_release", label: "Song releases", dot: "bg-brand-500", chip: "bg-brand-100 text-brand-900" },
  { key: "format", label: "Formats", dot: "bg-violet-500", chip: "bg-violet-100 text-violet-900" },
  { key: "content", label: "Content", dot: "bg-sky-500", chip: "bg-sky-100 text-sky-900" },
  { key: "task_due", label: "Task due", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-900" },
  { key: "deliverable_due", label: "File due", dot: "bg-zinc-400", chip: "bg-zinc-100 text-zinc-700" },
] as const;

type Event = { kind: string; page_id: string; song_id: string | null; ref_id: string | null; title: string; at: string; state: string };

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD in IST

async function Calendar({ searchParams }: Pick<PageProps<"/calendar">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const page = pageBySlug(s.pages, sp.page);
  const view = typeof sp.view === "string" && ["releases", "content"].includes(sp.view) ? sp.view : "all";

  const todayStr = ymd(new Date());
  const monthStr = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : todayStr.slice(0, 7);
  const [y, m] = monthStr.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - ((first.getUTCDay() + 6) % 7)); // weeks start Monday
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86400000));
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  let q = s.supabase
    .from("calendar_events")
    .select("kind, page_id, song_id, ref_id, title, at, state")
    .gte("at", new Date(gridStart.getTime() - 86400000).toISOString())
    .lt("at", new Date(days[41].getTime() + 2 * 86400000).toISOString())
    .order("at");
  if (page) q = q.eq("page_id", page.id);
  if (view === "releases") q = q.eq("kind", "song_release");
  if (view === "content") q = q.in("kind", ["content", "format"]);
  const { data } = await q;
  const events = (data ?? []) as Event[];

  const songIds = [...new Set(events.map((e) => e.song_id).filter(Boolean))] as string[];
  const { data: songs } = songIds.length
    ? await s.supabase.from("songs").select("id, code").in("id", songIds)
    : { data: [] as { id: string; code: string }[] };
  const codeOf = (id: string | null) => songs?.find((x) => x.id === id)?.code;

  const byDay = new Map<string, Event[]>();
  for (const e of events) {
    const k = ymd(new Date(e.at));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const link = (o: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { page: page?.slug, view: view === "all" ? undefined : view, month: monthStr, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    return `/calendar?${qs}`;
  };
  const tab = (active: boolean) => `rounded-md px-2.5 py-1 text-sm ${active ? "bg-white shadow-sm ring-1 ring-zinc-200" : "text-zinc-600"}`;

  return (
    <>
      <PageTitle
        title="Calendar"
        sub="Song releases and content go-live dates, in IST."
        actions={
          <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1">
            <Link href={link({ view: undefined })} className={tab(view === "all")}>All</Link>
            <Link href={link({ view: "releases" })} className={tab(view === "releases")}>Releases</Link>
            <Link href={link({ view: "content" })} className={tab(view === "content")}>Content</Link>
          </div>
        }
      />
      <PageTabs pages={s.pages} current={page?.slug} base="/calendar" extra={{ month: monthStr, view: view === "all" ? undefined : view }} />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={link({ month: prev })} className="btn-ghost !px-2">←</Link>
          <h2 className="w-44 text-center font-medium">{monthName}</h2>
          <Link href={link({ month: next })} className="btn-ghost !px-2">→</Link>
          <Link href={link({ month: todayStr.slice(0, 7) })} className="ml-1 text-sm text-brand-700">Today</Link>
        </div>
        <div className="hidden gap-3 text-xs text-zinc-600 md:flex">
          {KINDS.map((k) => (
            <span key={k.key} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${k.dot}`} />{k.label}</span>
          ))}
        </div>
      </div>

      {/* Month grid (md+) */}
      <div className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = d.toISOString().slice(0, 10);
            const inMonth = d.getUTCMonth() === m - 1;
            const list = byDay.get(key) ?? [];
            return (
              <div key={key} className={`min-h-28 border-b border-r border-zinc-100 p-1.5 ${inMonth ? "" : "bg-zinc-50/60 text-zinc-400"}`}>
                <div className={`mb-1 text-xs ${key === todayStr ? "inline-block rounded-full bg-brand-500 px-1.5 text-black" : ""}`}>{d.getUTCDate()}</div>
                <div className="space-y-1">
                  {list.slice(0, 4).map((e, i) => <Chip key={i} e={e} code={codeOf(e.song_id)} />)}
                  {list.length > 4 && <p className="text-[11px] text-zinc-500">+{list.length - 4} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda (phones) */}
      <div className="space-y-2 md:hidden">
        {[...byDay.entries()].filter(([k]) => k.startsWith(monthStr)).map(([k, list]) => (
          <div key={k} className="card p-3">
            <p className="mb-1 text-xs font-medium text-zinc-500">{k}</p>
            <div className="space-y-1">{list.map((e, i) => <Chip key={i} e={e} code={codeOf(e.song_id)} />)}</div>
          </div>
        ))}
        {events.length === 0 && <p className="text-sm text-zinc-500">Nothing this month.</p>}
      </div>
      {events.length === 0 && (
        <p className="mt-3 hidden text-sm text-zinc-500 md:block">
          Nothing scheduled this month. Set a planned release date on a song, then use “Plan 3 carousels + 3 verticals” on its page.
        </p>
      )}
    </>
  );
}

function Chip({ e, code }: { e: Event; code?: string }) {
  const k = KINDS.find((x) => x.key === e.kind) ?? KINDS[KINDS.length - 1];
  const body = (
    <span className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${k.chip} ${e.state === "live" || e.state === "done" ? "opacity-60 line-through" : ""}`}>
      {e.title}
    </span>
  );
  return code ? <Link href={`/songs/${code}`} title={e.title}>{body}</Link> : body;
}
