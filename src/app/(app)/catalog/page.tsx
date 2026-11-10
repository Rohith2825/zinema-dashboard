import { Suspense } from "react";
import Link from "next/link";
import { Cover } from "@/components/cover";
import { CatalogSkeleton } from "@/components/skeletons";
import { Empty, OwnershipTag, PageDot, PageTabs, PageTitle, pageShort } from "@/components/ui";
import { driveThumb } from "@/lib/drive";
import { getSession, pageBySlug } from "@/lib/session";
import { FORMAT_ICON, KIND_LABEL, fmtDate, stageLabel, type DeliverableKind, type FormatStatus, type StageKey } from "@/lib/types";

export default function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <Catalog searchParams={searchParams} />
    </Suspense>
  );
}

type Row = {
  id: string; code: string; title: string; artists: string | null; cover_url: string | null; ownership: string; current_stage: StageKey;
  planned_release_date: string | null; metadata: { language?: string } | null;
  page: { name: string; slug: string; code_prefix: string } | null;
  distribution_records: { isrc: string | null; release_date: string | null; distributor: string; legacy: boolean }[];
  song_formats: { kind: DeliverableKind; status: FormatStatus; format_publications: { platform: string }[] }[];
};

const VIEWS = [
  { key: "all", label: "All" },
  { key: "released", label: "Released" },
  { key: "in_progress", label: "In progress" },
  { key: "missing", label: "Missing details" },
] as const;

async function Catalog({ searchParams }: Pick<PageProps<"/catalog">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const page = pageBySlug(s.pages, sp.page);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const view = VIEWS.find((v) => v.key === sp.view)?.key ?? "all";
  const own = sp.own === "original" || sp.own === "community" ? sp.own : undefined;

  let query = s.supabase
    .from("songs")
    .select(
      "id, code, title, artists, cover_url, ownership, current_stage, planned_release_date, metadata, page:pages(name, slug, code_prefix), distribution_records(isrc, release_date, distributor, legacy), song_formats(kind, status, format_publications(platform))",
    )
    .is("archived_at", null)
    .order("code");
  if (page) query = query.eq("page_id", page.id);
  if (own) query = query.eq("ownership", own);
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, "")}%,code.ilike.%${q.replace(/[%,()]/g, "")}%,artists.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data, error } = await query;
  let songs = (data ?? []) as unknown as Row[];
  if (view === "released") songs = songs.filter((x) => x.current_stage === "live");
  if (view === "in_progress") songs = songs.filter((x) => x.current_stage !== "live");
  if (view === "missing") songs = songs.filter((x) => !x.artists || !x.cover_url);

  const extra = { q: q || undefined, view: view === "all" ? undefined : view, own };
  const href = (v: string, o: string | undefined = own) => {
    const p = new URLSearchParams();
    if (page) p.set("page", page.slug);
    if (q) p.set("q", q);
    if (v !== "all") p.set("view", v);
    if (o) p.set("own", o);
    const str = p.toString();
    return str ? `/catalog?${str}` : "/catalog";
  };

  return (
    <>
      <PageTitle
        title="Catalog"
        sub={`${songs.length} ${songs.length === 1 ? "song" : "songs"}${page ? ` on ${pageShort(page.name)}` : ""} · open a song to add its cover, artists, formats and where they're published`}
        actions={
          <form action="/catalog" className="flex gap-2">
            {page && <input type="hidden" name="page" value={page.slug} />}
            {view !== "all" && <input type="hidden" name="view" value={view} />}
            {own && <input type="hidden" name="own" value={own} />}
            <input name="q" defaultValue={q} placeholder="Search title, code, artist…" className="input w-60" aria-label="Search the catalog" />
          </form>
        }
      />
      <PageTabs pages={s.pages} current={page?.slug} base="/catalog" extra={extra} />
      <div className="mb-5 flex flex-wrap gap-1 border-b border-zinc-200">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href(v.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${view === v.key ? "border-brand-500 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
          >
            {v.label}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-1 pb-1.5">
          {([[undefined, "All"], ["original", "Zinema Originals"], ["community", "Community"]] as const).map(([o, label]) => (
            <Link
              key={label}
              href={href(view, o)}
              className={`rounded-full px-2.5 py-1 text-xs ${own === o ? "bg-zinc-900 text-white" : "text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}
            >
              {label}
            </Link>
          ))}
        </span>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error.message}</p>}

      {songs.length === 0 ? (
        <Empty>No songs match{q ? ` “${q}”` : ""}.</Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {songs.map((song) => <SongCard key={song.id} song={song} />)}
        </ul>
      )}
    </>
  );
}

function SongCard({ song }: { song: Row }) {
  const dist = song.distribution_records[0];
  const released = song.current_stage === "live";
  const formats = song.song_formats.filter((f) => f.status !== "dropped");
  const kinds = [...new Set(formats.map((f) => f.kind))];
  const live = formats.filter((f) => f.status === "live").length;
  const posts = formats.reduce((n, f) => n + f.format_publications.length, 0);
  const releaseDate = dist?.release_date ?? song.planned_release_date;

  return (
    <li>
      <Link href={`/songs/${song.code}`} className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
        <div className="relative">
          <Cover src={driveThumb(song.cover_url, 500)} code={song.code} title={song.title} prefix={song.page?.code_prefix} />
          <span className="absolute right-2 top-2"><OwnershipTag ownership={song.ownership} short /></span>
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${released ? "bg-brand-500 text-black" : "bg-white/90 text-zinc-800"}`}>
            {released ? "Released" : stageLabel(song.current_stage)}
          </span>
        </div>
        <div className="space-y-2 p-3">
          <div>
            <p className="truncate font-medium leading-snug group-hover:text-brand-700">{song.title}</p>
            <p className={`truncate text-xs ${song.artists ? "text-zinc-600" : "italic text-zinc-400"}`}>{song.artists || "Add artists"}</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <PageDot prefix={song.page?.code_prefix} />
            <span className="truncate">{pageShort(song.page?.name)}{song.metadata?.language && song.metadata.language !== pageShort(song.page?.name) ? ` · ${song.metadata.language}` : ""}</span>
            <span className="ml-auto font-mono">{song.code}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
            <span className="flex gap-1" aria-label={`Formats: ${kinds.map((k) => KIND_LABEL[k]).join(", ") || "none yet"}`}>
              {kinds.slice(0, 6).map((k) => {
                const st = formats.filter((f) => f.kind === k);
                const on = st.some((f) => f.status === "live");
                return (
                  <span
                    key={k}
                    title={`${KIND_LABEL[k]} · ${st.filter((f) => f.status === "live").length}/${st.length} live`}
                    className={`flex h-5 w-5 items-center justify-center rounded text-[11px] ${on ? "bg-brand-500 text-black" : "bg-zinc-100 text-zinc-500"}`}
                  >
                    {FORMAT_ICON[k] ?? "•"}
                  </span>
                );
              })}
              {kinds.length === 0 && <span className="text-[11px] text-zinc-400">No formats yet</span>}
            </span>
            <span className="shrink-0 text-[11px] text-zinc-500">{live}/{formats.length} live{posts ? ` · ${posts} posts` : ""}</span>
          </div>
          {(releaseDate || dist?.isrc) && (
            <p className="flex justify-between text-[11px] text-zinc-400">
              <span>{releaseDate ? fmtDate(releaseDate) : "No release date"}</span>
              {dist?.isrc && <span className="font-mono">{dist.isrc}</span>}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
