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
          <div className="flex items-center gap-3 rounded-2xl bg-background p-3 shadow-inset ring-2 ring-brand-500/50">
            <Avatar name={person.name} email={person.email} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{person.name}</p>
              <p className="truncate text-xs text-muted">{person.email}</p>
            </div>
            <button type="button" onClick={() => setPersonId("")} className="text-xs font-medium text-brand-700 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <div className="well overflow-hidden !rounded-2xl">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="hairline w-full border-b bg-transparent px-4 py-2.5 text-sm outline-none"
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
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/60"
                    >
                      <Avatar name={p.name} email={p.email} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted">{p.email}</span>
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
                <li className="px-3 py-3 text-xs text-muted">Nobody matches. People appear here after they sign in with Google once.</li>
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
                className={`rounded-2xl px-3 py-2.5 text-left transition ${on ? "bg-background shadow-inset ring-2 ring-brand-500/60" : "tile"}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <PageDot prefix={p.prefix} />
                  {p.name}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-muted">
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
                className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-background shadow-inset ring-2 ring-brand-500/60" : "tile"}`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${on ? "bg-brand-500 text-black" : "bg-[#0d0d10] text-white"}`}>
                  {r.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {r.label}
                    {already && <span className="ml-2 text-[11px] font-normal text-muted">already has this</span>}
                  </span>
                  <span className="block text-xs text-muted">{r.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-2xl bg-[#0d0d10] p-4 text-sm text-zinc-300 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]">
        {ready ? (
          <p>
            Give <b className="text-white">{person.name}</b> the <b className="text-brand-400">{roleInfo?.label}</b> role on{" "}
            <b className="text-white">{page.name}</b>.
          </p>
        ) : (
          <p className="text-muted">Pick a person, a page and a role.</p>
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
