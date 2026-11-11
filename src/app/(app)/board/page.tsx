import { Suspense } from "react";
import { BoardSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { getSession, pageBySlug } from "@/lib/session";
import { STAGES, type StageKey } from "@/lib/types";
import { StageModal } from "@/components/stage-modal";
import { Badge, OwnershipTag, PageDot, PageTabs, PageTitle, pageShort } from "@/components/ui";

export default function BoardPage({ searchParams }: PageProps<"/board">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board searchParams={searchParams} />
    </Suspense>
  );
}

type SongRow = {
  id: string;
  code: string;
  title: string;
  ownership: string;
  current_stage: StageKey;
  planned_release_date: string | null;
  metadata: { language?: string | null; imported?: boolean } | null;
  page: { name: string; slug: string; code_prefix: string } | null;
  deliverables: { kind: string; stage: StageKey; required: boolean; assignee_id: string | null; deliverable_versions: { status: string }[] }[];
  distribution_records: { isrc: string; distributor: string; legacy: boolean }[];
  song_formats: { status: string }[];
};

async function Board({ searchParams }: Pick<PageProps<"/board">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const page = pageBySlug(s.pages, sp.page);

  let q = s.supabase
    .from("songs")
    .select(
      "id, code, title, ownership, current_stage, planned_release_date, metadata, page:pages(name, slug, code_prefix), deliverables(kind, stage, required, assignee_id, deliverable_versions(status)), distribution_records(isrc, distributor, legacy), song_formats(status)",
    )
    .is("archived_at", null)
    .order("code");
  if (page) q = q.eq("page_id", page.id);
  const { data, error } = await q;
  const songs = (data ?? []) as unknown as SongRow[];

  const canCreate = s.level !== null && s.level !== "viewer";
  const columns = STAGES.map((st) => ({ ...st, songs: songs.filter((x) => x.current_stage === st.key) }));

  return (
    <>
      <PageTitle
        title="Song board"
        sub={`${songs.length} songs${page ? ` on ${pageShort(page.name)}` : ""}`}
        actions={canCreate && <Link href={`/songs/new${page ? `?page=${page.slug}` : ""}`} className="btn">+ New song</Link>}
      />
      <PageTabs pages={s.pages} current={page?.slug} base="/board" />
      {error && <p className="mb-3 text-sm text-red-600">{error.message}</p>}
      {/* All eight stages on one screen: compact rows, each column scrolls on its own, ⤢ opens the full stage. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 2xl:grid-cols-8">
        {columns.map((col) => (
          <section key={col.key} className="well flex max-h-72 min-h-24 flex-col p-2.5 md:h-[calc((100vh-21rem)/2)] md:max-h-none md:min-h-56 2xl:h-[calc(100vh-19rem)]">
            <header className="flex items-center justify-between px-1.5 pb-0 pt-1">
              <h2 className="eyebrow truncate !text-zinc-700">{col.label}</h2>
              <span className="flex items-center gap-1">
                <span className="rounded-full bg-black/[0.06] px-1.5 text-[11px] font-medium text-zinc-600">{col.songs.length}</span>
                <StageModal title={col.label} count={col.songs.length}>
                  {col.songs.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted">No songs at this stage.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {col.songs.map((song) => <SongCard key={song.id} song={song} showPage={!page} />)}
                    </div>
                  )}
                </StageModal>
              </span>
            </header>
            {/* Padding leaves room for the cards' soft shadows, so the scroll area never cuts them into a hard edge. */}
            <div className="-mx-2.5 -mb-2.5 flex-1 space-y-2.5 overflow-y-auto rounded-b-[20px] px-3.5 pb-4 pt-2.5 [scrollbar-width:thin]">
              {col.songs.map((song) => <CompactCard key={song.id} song={song} />)}
              {col.songs.length === 0 && <p className="px-1 pt-6 text-center text-[11px] text-zinc-400">Empty</p>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function SongCard({ song, showPage }: { song: SongRow; showPage: boolean }) {
  const inStage = song.deliverables.filter((d) => d.stage === song.current_stage && d.required);
  const approved = inStage.filter((d) => d.deliverable_versions.some((v) => v.status === "approved")).length;
  const waiting = song.deliverables.filter((d) => d.deliverable_versions.some((v) => v.status === "submitted")).length;
  const promo = (kind: string) =>
    song.deliverables.filter((d) => d.kind === kind && d.deliverable_versions.some((v) => v.status === "approved")).length;
  const dist = song.distribution_records[0];
  const formats = song.song_formats.filter((f) => f.status !== "dropped");
  const formatsLive = formats.filter((f) => f.status === "live").length;
  const live = song.current_stage === "live";

  return (
    <Link href={`/songs/${song.code}`} className="tile block p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">{song.code}</span>
        {showPage && <Badge>{pageShort(song.page?.name)}</Badge>}
      </div>
      <p className="mt-1 font-medium leading-snug">{song.title}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {song.ownership === "community" && <OwnershipTag ownership="community" />}
        {!live && inStage.length > 0 && (
          <Badge tone={approved === inStage.length ? "green" : "zinc"}>
            {approved}/{inStage.length} approved
          </Badge>
        )}
        {waiting > 0 && <Badge tone="blue">{waiting} to check</Badge>}
        {!song.metadata?.imported && ["promo", "posting", "live"].includes(song.current_stage) && (
          <>
            <Badge tone={promo("carousel") >= 3 ? "green" : "amber"}>C {promo("carousel")}/3</Badge>
            <Badge tone={promo("vertical") >= 3 ? "green" : "amber"}>V {promo("vertical")}/3</Badge>
          </>
        )}
        {formats.length > 0 && (
          <Badge tone={formatsLive === formats.length ? "green" : "zinc"}>
            Formats {formatsLive}/{formats.length} live
          </Badge>
        )}
        {dist && (
          <Badge tone={dist.legacy ? "zinc" : "violet"}>
            {dist.distributor}
            {dist.legacy ? " · legacy" : ""}
          </Badge>
        )}
        {song.planned_release_date && !live && <Badge tone="amber">Release {song.planned_release_date}</Badge>}
      </div>
    </Link>
  );
}

/** One-line-ish card for the single-screen board. Hover (or the expand view) shows the detail. */
function CompactCard({ song }: { song: SongRow }) {
  const inStage = song.deliverables.filter((d) => d.stage === song.current_stage && d.required);
  const approved = inStage.filter((d) => d.deliverable_versions.some((v) => v.status === "approved")).length;
  const waiting = song.deliverables.filter((d) => d.deliverable_versions.some((v) => v.status === "submitted")).length;
  const pct = inStage.length ? Math.round((approved / inStage.length) * 100) : song.current_stage === "live" ? 100 : 0;
  return (
    <Link href={`/songs/${song.code}`} title={`${song.code} · ${song.title}`} className="tile block !rounded-xl px-2.5 py-2">
      <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
        <PageDot prefix={song.page?.code_prefix} />
        {song.code}
        {waiting > 0 && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-500" title={`${waiting} to check`} />}
      </span>
      <span className="mt-0.5 block truncate text-[13px] font-medium leading-snug">{song.title}</span>
      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-black/[0.07]">
        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}
