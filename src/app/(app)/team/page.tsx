import { Suspense } from "react";
import Link from "next/link";
import { removeMember } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { RolePicker, type PickerPage, type PickerPerson } from "@/components/role-picker";
import { TeamSkeleton } from "@/components/skeletons";
import { Avatar, Badge, PageDot, PageTitle, pageShort } from "@/components/ui";
import { getSession } from "@/lib/session";
import { ROLES, shortName, type PageRole, type Profile } from "@/lib/types";

export default function TeamPage({ searchParams }: PageProps<"/team">) {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <Team searchParams={searchParams} />
    </Suspense>
  );
}

async function Team({ searchParams }: Pick<PageProps<"/team">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const [{ data: peopleData }, { data: memberData }, { data: ownersData }] = await Promise.all([
    s.supabase.from("profiles").select("id, full_name, email, is_org_admin").order("full_name"),
    s.supabase.from("page_members").select("user_id, page_id, role"),
    s.isOwner ? s.supabase.from("rights_owners").select("user_id") : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);
  const people = (peopleData ?? []) as Profile[];
  const members = (memberData ?? []) as { user_id: string; page_id: string; role: PageRole }[];
  const owners = new Set((ownersData ?? []).map((o) => o.user_id));
  const adminPages = s.pages.filter((p) => s.roleOn(p.id, ["page_admin"]));
  const roleLabel = (r: string) => ROLES.find((x) => x.key === r)?.label ?? r;
  const pageOf = (id: string) => s.pages.find((p) => p.id === id);
  const needRole = people.filter((p) => !p.is_org_admin && !members.some((m) => m.user_id === p.id));

  const pickerPeople: PickerPerson[] = people.map((p) => ({
    id: p.id,
    name: shortName(p),
    email: p.email,
    isAdmin: p.is_org_admin,
    roles: members.filter((m) => m.user_id === p.id).map((m) => ({ pageId: m.page_id, role: m.role })),
  }));
  const pickerPages: PickerPage[] = adminPages.map((p) => ({
    id: p.id,
    name: pageShort(p.name),
    prefix: p.code_prefix,
    members: new Set(members.filter((m) => m.page_id === p.id).map((m) => m.user_id)).size,
  }));

  return (
    <>
      <PageTitle
        title="Team"
        sub={
          <>
            {people.length} {people.length === 1 ? "person" : "people"}
            {needRole.length > 0 && <> · <span className="font-medium text-amber-700">{needRole.length} waiting for a role</span></>}
            {" · "}people appear here after signing in with Google once.
          </>
        }
      />

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Roster */}
        <ul className="grid gap-6 sm:grid-cols-2">
          {people.map((p) => {
            const mine = members.filter((m) => m.user_id === p.id);
            const byPage = [...new Set(mine.map((m) => m.page_id))];
            const fresh = mine.length === 0 && !p.is_org_admin;
            return (
              <li key={p.id} className={`card p-5 ${fresh ? "ring-2 ring-amber-400/50" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={p.full_name} email={p.email} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {shortName(p)}
                      {p.id === s.user.id && <span className="ml-1.5 text-xs font-normal text-zinc-400">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{p.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {p.is_org_admin && <Badge tone="violet">Admin</Badge>}
                    {owners.has(p.id) && <Badge tone="green">Owner</Badge>}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {p.is_org_admin && <p className="text-xs text-muted">Full access to every page.</p>}
                  {byPage.map((pid) => {
                    const pg = pageOf(pid);
                    const canEdit = s.roleOn(pid, ["page_admin"]);
                    return (
                      <div key={pid} className="flex flex-wrap items-center gap-1.5">
                        <span className="flex w-24 items-center gap-1.5 text-xs font-medium text-zinc-700">
                          <PageDot prefix={pg?.code_prefix} />
                          {pageShort(pg?.name)}
                        </span>
                        {mine.filter((m) => m.page_id === pid).map((m) => (
                          <span key={m.role} className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] py-0.5 pl-2.5 pr-1.5 text-xs">
                            {roleLabel(m.role)}
                            {canEdit && (
                              <ActionForm action={removeMember} confirm={`Remove ${shortName(p)} as ${roleLabel(m.role)} on ${pageShort(pg?.name)}?`}>
                                <input type="hidden" name="user_id" value={m.user_id} />
                                <input type="hidden" name="page_id" value={m.page_id} />
                                <input type="hidden" name="role" value={m.role} />
                                <button className="flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 hover:bg-red-100 hover:text-red-600" aria-label={`Remove ${roleLabel(m.role)} role`}>
                                  ✕
                                </button>
                              </ActionForm>
                            )}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                  {fresh && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
                      <span>Signed in, but has no role yet.</span>
                      {adminPages.length > 0 && (
                        <Link href={`/team?person=${p.id}#give-role`} scroll={false} className="font-medium text-brand-700 hover:underline">
                          Give a role →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Give a role */}
        {adminPages.length > 0 && (
          <section id="give-role" className="card p-6 xl:sticky xl:top-8">
            <h2 className="font-medium">Give someone a role</h2>
            <p className="mb-4 mt-0.5 text-xs text-muted">One person can hold different roles on different pages.</p>
            <RolePicker
              key={typeof sp.person === "string" ? sp.person : "none"}
              people={pickerPeople}
              pages={pickerPages}
              defaultPerson={typeof sp.person === "string" ? sp.person : undefined}
            />
          </section>
        )}
      </div>
    </>
  );
}
