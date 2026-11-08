"use client";

import { useActionState, useMemo, useState } from "react";
import { addMember } from "@/app/actions";
import { Avatar, PageDot } from "@/components/ui";
import { ROLES, type PageRole } from "@/lib/types";

export type PickerPerson = { id: string; name: string; email: string; isAdmin: boolean; roles: { pageId: string; role: PageRole }[] };
export type PickerPage = { id: string; name: string; prefix: string; members: number };

/** "Give someone a role": searchable person list, page tiles and role cards, with a plain-English summary. */
export function RolePicker({ people, pages, defaultPerson }: { people: PickerPerson[]; pages: PickerPage[]; defaultPerson?: string }) {
  const [state, formAction, pending] = useActionState(addMember, undefined);
  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState(defaultPerson && people.some((p) => p.id === defaultPerson) ? defaultPerson : "");
  const [pageId, setPageId] = useState(pages.length === 1 ? pages[0].id : "");
  const [role, setRole] = useState<PageRole | "">("");

  const person = people.find((p) => p.id === personId);
  const page = pages.find((p) => p.id === pageId);
  const has = (r: PageRole) => Boolean(person?.roles.some((x) => x.pageId === pageId && x.role === r));
  const roleInfo = ROLES.find((r) => r.key === role);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? people.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q)) : people;
    // People without any access first: they're the ones who need a role.
    return [...list].sort((a, b) => Number(a.roles.length > 0 || a.isAdmin) - Number(b.roles.length > 0 || b.isAdmin) || a.name.localeCompare(b.name));
  }, [people, query]);

  const ready = person && page && role && !has(role);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="user_id" value={personId} />
      <input type="hidden" name="page_id" value={pageId} />
      <input type="hidden" name="role" value={role} />

      {/* 1 · Person */}
      <fieldset>
        <legend className="label">1 · Who</legend>
        {person ? (
          <div className="flex items-center gap-3 rounded-lg border border-brand-300 bg-brand-50 p-2.5">
            <Avatar name={person.name} email={person.email} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{person.name}</p>
              <p className="truncate text-xs text-zinc-500">{person.email}</p>
            </div>
            <button type="button" onClick={() => setPersonId("")} className="text-xs font-medium text-brand-700 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-t-lg border-b border-zinc-200 px-3 py-2 text-sm outline-none focus:bg-brand-50/40"
              aria-label="Search people"
            />
            <ul className="max-h-60 overflow-y-auto py-1" role="listbox" aria-label="People">
              {matches.map((p) => {
                const fresh = p.roles.length === 0 && !p.isAdmin;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => setPersonId(p.id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50"
                    >
                      <Avatar name={p.name} email={p.email} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                      </span>
                      {fresh ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Needs a role</span>
                      ) : (
                        <span className="text-[11px] text-zinc-400">{p.isAdmin ? "Admin" : `${p.roles.length} role${p.roles.length === 1 ? "" : "s"}`}</span>
                      )}
                    </button>
                  </li>
                );
              })}
              {matches.length === 0 && (
                <li className="px-3 py-3 text-xs text-zinc-500">Nobody matches. People appear here after they sign in with Google once.</li>
              )}
            </ul>
          </div>
        )}
      </fieldset>

      {/* 2 · Page */}
      <fieldset>
        <legend className="label">2 · Which page</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pages.map((p) => {
            const on = p.id === pageId;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPageId(p.id)}
                className={`rounded-lg border px-3 py-2 text-left transition ${on ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <PageDot prefix={p.prefix} />
                  {p.name}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                  {p.prefix} · {p.members} {p.members === 1 ? "person" : "people"}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 3 · Role */}
      <fieldset>
        <legend className="label">3 · Role</legend>
        <div className="space-y-1.5">
          {ROLES.map((r) => {
            const on = r.key === role;
            const already = has(r.key);
            return (
              <button
                key={r.key}
                type="button"
                disabled={already}
                aria-pressed={on}
                onClick={() => setRole(r.key)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"}`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm ${on ? "bg-brand-500 text-black" : "bg-zinc-900 text-white"}`}>
                  {r.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {r.label}
                    {already && <span className="ml-2 text-[11px] font-normal text-zinc-500">already has this</span>}
                  </span>
                  <span className="block text-xs text-zinc-500">{r.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-lg bg-zinc-900 p-3 text-sm text-zinc-300">
        {ready ? (
          <p>
            Give <b className="text-white">{person.name}</b> the <b className="text-brand-400">{roleInfo?.label}</b> role on{" "}
            <b className="text-white">{page.name}</b>.
          </p>
        ) : (
          <p className="text-zinc-500">Pick a person, a page and a role.</p>
        )}
        <button type="submit" disabled={!ready || pending} className="btn mt-3 w-full">
          {pending ? "Adding…" : "Add role"}
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
    </form>
  );
}
