import { Suspense } from "react";
import { addMember, removeMember } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, PageTitle, pageShort } from "@/components/ui";
import { getSession } from "@/lib/session";
import { ROLES, shortName, type PageRole, type Profile } from "@/lib/types";

export default function TeamPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading team…</p>}>
      <Team />
    </Suspense>
  );
}

async function Team() {
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

  return (
    <>
      <PageTitle title="Team" sub="People sign in with Google once; then give them a role on a page." />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Person</th>
              <th className="px-4 py-2 font-medium">Access</th>
              <th className="px-4 py-2 font-medium">Page roles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {people.map((p) => {
              const mine = members.filter((m) => m.user_id === p.id);
              return (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{shortName(p)}</p>
                    <p className="text-xs text-zinc-500">{p.email}</p>
                  </td>
                  <td className="space-x-1 px-4 py-3">
                    {p.is_org_admin && <Badge tone="violet">Admin · all pages</Badge>}
                    {owners.has(p.id) && <Badge tone="green">Owner</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {mine.map((m) => (
                        <span key={m.page_id + m.role} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                          {pageShort(s.pages.find((x) => x.id === m.page_id)?.name)} · {roleLabel(m.role)}
                          {s.roleOn(m.page_id, ["page_admin"]) && (
                            <ActionForm action={removeMember} confirm="Remove this role?">
                              <input type="hidden" name="user_id" value={m.user_id} />
                              <input type="hidden" name="page_id" value={m.page_id} />
                              <input type="hidden" name="role" value={m.role} />
                              <button className="text-zinc-400 hover:text-red-600" aria-label="Remove role">✕</button>
                            </ActionForm>
                          )}
                        </span>
                      ))}
                      {mine.length === 0 && !p.is_org_admin && <span className="text-xs text-zinc-400">No access yet</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adminPages.length > 0 && (
        <section className="card mt-4 max-w-2xl p-4">
          <h2 className="mb-3 font-medium">Give someone a role</h2>
          <ActionForm action={addMember} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <select name="user_id" required className="input" defaultValue="">
              <option value="" disabled>Person…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{shortName(p)} ({p.email})</option>)}
            </select>
            <select name="page_id" required className="input" defaultValue="">
              <option value="" disabled>Page…</option>
              {adminPages.map((p) => <option key={p.id} value={p.id}>{pageShort(p.name)}</option>)}
            </select>
            <select name="role" required className="input" defaultValue="maker">
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <Submit>Add</Submit>
          </ActionForm>
          <p className="mt-3 text-xs text-zinc-500">
            Makers submit files · Checkers approve or request changes (never their own) · Approvers move songs to the next stage · Page admins manage roles.
          </p>
        </section>
      )}
    </>
  );
}
