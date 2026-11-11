import { Suspense } from "react";
import Link from "next/link";
import { RolePicker, type PickerPage, type PickerPerson } from "@/components/role-picker";
import { TeamSkeleton } from "@/components/skeletons";
import { Avatar, Badge, PageDot, PageTitle, pageShort } from "@/components/ui";
import { getSession } from "@/lib/session";
import { ROLES, shortName, type Profile } from "@/lib/types";

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
  const [{ data: peopleData }, { data: memberData }, { data: allData }, { data: ownersData }] = await Promise.all([
    s.supabase.from("profiles").select("id, full_name, nickname, handle, bio, email, is_org_admin").order("full_name"),
    s.supabase.from("page_members").select("user_id, page_id, role"),
    s.supabase.from("all_page_roles").select("user_id, role"),
    s.isOwner ? s.supabase.from("rights_owners").select("user_id") : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);
  const people = (peopleData ?? []) as Profile[];
  const members = (memberData ?? []) as { user_id: string; page_id: string; role: "core" | "viewer" }[];
  const allRoles = new Map((allData ?? []).map((r) => [r.user_id as string, r.role as "core" | "viewer"]));
  const owners = new Set((ownersData ?? []).map((o) => o.user_id));
  const pageOf = (id: string) => s.pages.find((p) => p.id === id);

  const roster: PickerPerson[] = people.map((p) => {
    const mine = members.filter((m) => m.user_id === p.id);
    const all = allRoles.get(p.id);
    // Non-owners can't tell owners from admins (that list is private), so both show as Admin to them.
    const level = owners.has(p.id) ? "owner" : p.is_org_admin ? "admin" : (all ?? (mine.some((m) => m.role === "core") ? "core" : mine.length ? "viewer" : null));
    return { id: p.id, name: shortName(p), handle: p.handle ?? null, email: p.email, level, allPages: Boolean(all), pageIds: mine.map((m) => m.page_id) };
  });
  const pickerPages: PickerPage[] = s.pages.map((p) => ({
    id: p.id,
    name: pageShort(p.name),
    prefix: p.code_prefix,
    members: new Set(members.filter((m) => m.page_id === p.id).map((m) => m.user_id)).size,
  }));
  const waiting = roster.filter((r) => r.level === null).length;
  const selected = typeof sp.person === "string" ? sp.person : undefined;
  const order = { owner: 0, admin: 1, core: 2, viewer: 3 } as const;
  const sorted = [...roster].sort((a, b) => (a.level ? order[a.level] : -1) - (b.level ? order[b.level] : -1) || a.name.localeCompare(b.name));

  return (
    <>
      <PageTitle
        title="Team"
        sub={
          <>
            {people.length} {people.length === 1 ? "person" : "people"}
            {waiting > 0 && <> · <span className="font-medium text-amber-700">{waiting} waiting for access</span></>}
            {" · "}people appear here after signing in with Google once.
          </>
        }
        actions={<Link href="/profile" className="btn-ghost">Edit my profile</Link>}
      />

      {/* What each level means */}
      <ul className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <li key={r.key} className="tile p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${r.key === "owner" ? "bg-brand-500 text-black" : "bg-[#0d0d10] text-white"}`}>{r.icon}</span>
              {r.label}
              <span className="ml-auto text-xs font-normal text-muted">{roster.filter((x) => x.level === r.key).length}</span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{r.desc}</p>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ul className="grid gap-6 sm:grid-cols-2">
          {sorted.map((r) => {
            const p = people.find((x) => x.id === r.id)!;
            return (
              <li key={r.id} className={`card p-5 ${r.level === null ? "ring-2 ring-amber-400/50" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} email={r.email} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {r.name}
                      {r.id === s.user.id && <span className="ml-1.5 text-xs font-normal text-zinc-400">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{r.handle ? `@${r.handle}` : r.email}</p>
                  </div>
                  {r.level && <Badge tone={r.level === "owner" ? "violet" : r.level === "admin" ? "blue" : r.level === "core" ? "green" : "zinc"}>{ROLES.find((x) => x.key === r.level)?.label}</Badge>}
                </div>
                {p.bio && <p className="mt-3 text-sm text-zinc-700">{p.bio}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  {r.level === "owner" || r.level === "admin" || r.allPages ? (
                    <span className="rounded-full bg-[#0d0d10] px-2.5 py-1 font-medium text-white">All pages</span>
                  ) : (
                    r.pageIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1">
                        <PageDot prefix={pageOf(id)?.code_prefix} />
                        {pageShort(pageOf(id)?.name)}
                      </span>
                    ))
                  )}
                  {r.level === null && <span className="rounded-xl bg-amber-500/10 px-3 py-1.5 text-amber-900">Signed in, no access yet</span>}
                  {s.isAdmin && r.level !== "owner" && (
                    <Link href={`/team?person=${r.id}#access`} scroll={false} className="ml-auto font-medium text-brand-700 hover:underline">
                      {r.level === null ? "Give access →" : "Change"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {s.isAdmin && (
          <section id="access" className="card p-5 md:p-6 xl:sticky xl:top-8">
            <h2 className="font-medium">Set someone&apos;s access</h2>
            <p className="mb-4 mt-0.5 text-xs text-muted">One level per person, on the pages you choose or on all of them.</p>
            <RolePicker key={selected ?? "none"} people={roster} pages={pickerPages} defaultPerson={selected} canMakeAdmins={s.isOwner} />
          </section>
        )}
      </div>
    </>
  );
}
