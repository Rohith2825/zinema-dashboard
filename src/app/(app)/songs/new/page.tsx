import { Suspense } from "react";
import { createSong } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { PageTitle } from "@/components/ui";
import { getSession, pageBySlug } from "@/lib/session";

export default function NewSongPage({ searchParams }: PageProps<"/songs/new">) {
  return (
    <Suspense fallback={null}>
      <NewSong searchParams={searchParams} />
    </Suspense>
  );
}

async function NewSong({ searchParams }: Pick<PageProps<"/songs/new">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const allowed = s.pages.filter((p) => s.roleOn(p.id, ["page_admin", "approver", "maker"]));
  const preset = pageBySlug(allowed, sp.page);

  return (
    <div className="max-w-lg">
      <PageTitle title="New song" sub="Creates the song's stages and its required items (lyrics, master, artwork, 3 carousels, 3 verticals…)." />
      <ActionForm action={createSong} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required className="input" placeholder="e.g. Kaadhal Mazhai" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="page_id">Page</label>
            <select id="page_id" name="page_id" required className="input" defaultValue={preset?.id ?? ""}>
              <option value="" disabled>Choose…</option>
              {allowed.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="language">Language</label>
            <select id="language" name="language" className="input" defaultValue="">
              <option value="">—</option>
              <option>Tamil</option>
              <option>Hindi</option>
              <option>Marathi</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="planned_release_date">Planned release date (optional)</label>
          <input id="planned_release_date" name="planned_release_date" type="date" className="input" />
        </div>
        <Submit>Create song</Submit>
      </ActionForm>
    </div>
  );
}
