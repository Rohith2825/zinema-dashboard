import { Suspense } from "react";
import { BoardSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { getSession, pageBySlug } from "@/lib/session";
import { STAGES, type StageKey } from "@/lib/types";
import { Badge, PageTabs, PageTitle, pageShort } from "@/components/ui";

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
  current_stage: StageKey;
  planned_release_date: string | null;
  metadata: { language?: string | null; imported?: boolean } | null;
  page: { name: string; slug: string } | null;
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
      "id, code, title, current_stage, planned_release_date, metadata, page:pages(name, slug), deliverables(kind, stage, required, assignee_id, deliverable_versions(status)), distribution_records(isrc, distributor, legacy), song_formats(status)",
    )
    .is("archived_at", null)
    .order("code");
  if (page) q = q.eq("page_id", page.id);
  const { data, error } = await q;
  const songs = (data ?? []) as unknown as SongRow[];

  const canCreate = s.isAdmin || s.memberships.some((m) => ["page_admin", "approver", "maker"].includes(m.role));
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
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="flex min-w-max gap-3">
          {columns.map((col) => (
            <section key={col.key} className="w-64 shrink-0 rounded-xl bg-zinc-100/70 p-2">
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-zinc-700">{col.label}</h2>
                <span className="text-xs text-zinc-500">{col.songs.length}</span>
              </header>
              <div className="space-y-2">
                {col.songs.map((song) => (
                  <SongCard key={song.id} song={song} showPage={!page} />
                ))}
              </div>
            </section>
          ))}
        </div>
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
    <Link href={`/songs/${song.code}`} className="block rounded-lg border border-zinc-200 bg-white p-3 shadow-sm hover:border-brand-300">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-zinc-500">{song.code}</span>
        {showPage && <Badge>{pageShort(song.page?.name)}</Badge>}
      </div>
      <p className="mt-1 font-medium leading-snug">{song.title}</p>
      <div className="mt-2 flex flex-wrap gap-1">
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
