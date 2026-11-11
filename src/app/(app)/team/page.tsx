import { Suspense } from "react";
import Link from "next/link";
import { AccessDialog } from "@/components/access-dialog";
import type { PickerPage, PickerPerson } from "@/components/role-picker";
import { TeamSkeleton } from "@/components/skeletons";
import { Avatar, Badge, PageDot, PageTitle, pageShort } from "@/components/ui";
import { getSession } from "@/lib/session";
import { ROLES, shortName, type Profile } from "@/lib/types";

export default function TeamPage() {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <Team />
    </Suspense>
  );
}

async function Team() {
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
  const order = { owner: 0, admin: 1, core: 2, viewer: 3 } as const;
  const sorted = [...roster].sort((a, b) => (a.level ? order[a.level] : -1) - (b.level ? order[b.level] : -1) || a.name.localeCompare(b.name));

  const needs = sorted.filter((r) => r.level === null);
  const team = sorted.filter((r) => r.level !== null);
  const tone = { owner: "violet", admin: "blue", core: "green", viewer: "zinc" } as const;

  return (
    <>
      <PageTitle
        title="Team"
        sub="Everyone who has signed in. Admins decide who gets in, at what level, and on which pages."
        actions={<Link href="/profile" className="btn-ghost">Edit my profile</Link>}
      />

      {/* 1 · People waiting: the thing an admin came here to do */}
      {needs.length > 0 && (
        <section className="card mb-8 p-5 ring-2 ring-amber-400/40 md:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Waiting for access <span className="ml-1 text-sm font-normal text-amber-700">{needs.length}</span></h2>
            <p className="hidden text-xs text-muted sm:block">They&apos;ve signed in and can&apos;t see anything yet.</p>
          </div>
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {needs.map((r) => (
              <li key={r.id} className="tile flex items-center gap-3 p-3">
                <Avatar name={r.name} email={r.email} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted">{r.email}</p>
                </div>
                {s.isAdmin && <AccessDialog person={r} pages={pickerPages} canMakeAdmins={s.isOwner} primary />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2 · The team, grouped by level */}
      <div className="space-y-8">
        {ROLES.map((level) => {
          const group = team.filter((r) => r.level === level.key);
          if (group.length === 0) return null;
          return (
            <section key={level.key}>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${level.key === "owner" ? "bg-brand-500 text-black" : "bg-[#0d0d10] text-white"}`}>{level.icon}</span>
                <h2 className="text-lg font-semibold">{level.label} <span className="ml-1 text-sm font-normal text-muted">{group.length}</span></h2>
                <p className="text-xs text-muted">{level.desc}</p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.map((r) => {
                  const p = people.find((x) => x.id === r.id)!;
                  return (
                    <li key={r.id} className="card flex flex-col p-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} email={r.email} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {r.name}
                            {r.id === s.user.id && <span className="ml-1.5 text-xs font-normal text-zinc-400">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-muted">{r.handle ? `@${r.handle}` : r.email}</p>
                        </div>
                        <Badge tone={tone[level.key]}>{level.label}</Badge>
                      </div>
                      {p.bio && <p className="mt-3 line-clamp-3 text-sm text-zinc-700">{p.bio}</p>}
                      <div className="mt-4 flex flex-1 flex-wrap items-end justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5 text-xs">
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
                        </div>
                        {s.isAdmin && r.level !== "owner" && r.id !== s.user.id && <AccessDialog person={r} pages={pickerPages} canMakeAdmins={s.isOwner} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
