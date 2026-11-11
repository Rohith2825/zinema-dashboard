"use client";

import { useActionState, useMemo, useState } from "react";
import { setAccess } from "@/app/actions";
import { Avatar, PageDot } from "@/components/ui";
import { ROLES } from "@/lib/types";

export type PickerPerson = {
  id: string; name: string; handle: string | null; email: string;
  level: "owner" | "admin" | "core" | "viewer" | null; allPages: boolean; pageIds: string[];
};
export type PickerPage = { id: string; name: string; prefix: string; members: number };
type Level = "admin" | "core" | "viewer" | "none";

/** "Set access": person → level → which pages (or all of them), with a plain-English summary. */
export function RolePicker({ people, pages, defaultPerson, canMakeAdmins, fixed = false }: { people: PickerPerson[]; pages: PickerPage[]; defaultPerson?: string; canMakeAdmins: boolean; fixed?: boolean }) {
  const [state, formAction, pending] = useActionState(setAccess, undefined);
  const [query, setQuery] = useState("");
  const start = people.find((p) => p.id === defaultPerson);
  const [personId, setPersonId] = useState(start?.id ?? "");
  const [level, setLevel] = useState<Level | "">(start && start.level && start.level !== "owner" ? start.level : "");
  const [all, setAll] = useState(start?.allPages ?? false);
  const [picked, setPicked] = useState<string[]>(start?.pageIds ?? []);

  const person = people.find((p) => p.id === personId);
  function choose(p: PickerPerson) {
    setPersonId(p.id);
    setLevel(p.level && p.level !== "owner" ? p.level : "");
    setAll(p.allPages);
    setPicked(p.pageIds);
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    const list = q ? people.filter((p) => `${p.name} ${p.handle ?? ""} ${p.email}`.toLowerCase().includes(q)) : people;
    return [...list].sort((a, b) => Number(a.level !== null) - Number(b.level !== null) || a.name.localeCompare(b.name));
  }, [people, query]);

  const scoped = level === "core" || level === "viewer";
  const ready = Boolean(person && level && (!scoped || all || picked.length > 0)) && person?.level !== "owner";
  const levels = ROLES.filter((r) => r.key !== "owner");
  const pageNames = pages.filter((p) => picked.includes(p.id)).map((p) => p.name);
  const levelLabel = levels.find((r) => r.key === level)?.label;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="user_id" value={personId} />
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="scope" value={all ? "all" : "pages"} />
      {!all && picked.map((id) => <input key={id} type="hidden" name="page_ids" value={id} />)}

      {/* 1 · Person */}
      <fieldset>
        <legend className="label">{fixed ? "Person" : "1 · Who"}</legend>
        {person ? (
          <div className="flex items-center gap-3 rounded-2xl bg-background p-3 shadow-inset ring-2 ring-brand-500/50">
            <Avatar name={person.name} email={person.email} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{person.name}</p>
              <p className="truncate text-xs text-muted">{person.handle ? `@${person.handle} · ` : ""}{person.email}</p>
            </div>
            {!fixed && <button type="button" onClick={() => setPersonId("")} className="text-xs font-medium text-brand-700 hover:underline">Change</button>}
          </div>
        ) : (
          <div className="well overflow-hidden !rounded-2xl">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, @id or email…" className="hairline w-full border-b bg-transparent px-4 py-2.5 text-sm outline-none" aria-label="Search people" />
            <ul className="max-h-60 overflow-y-auto py-1" role="listbox" aria-label="People">
              {matches.map((p) => (
                <li key={p.id}>
                  <button type="button" role="option" aria-selected={false} onClick={() => choose(p)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/60">
                    <Avatar name={p.name} email={p.email} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{p.handle ? `@${p.handle}` : p.email}</span>
                    </span>
                    {p.level === null ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800">Needs access</span>
                    ) : (
                      <span className="text-[11px] text-zinc-400">{ROLES.find((r) => r.key === p.level)?.label}</span>
                    )}
                  </button>
                </li>
              ))}
              {matches.length === 0 && <li className="px-4 py-3 text-xs text-muted">Nobody matches. People appear here after they sign in with Google once.</li>}
            </ul>
          </div>
        )}
        {person?.level === "owner" && <p className="mt-2 text-xs text-muted">Owners always have full access. It can&apos;t be changed here.</p>}
      </fieldset>

      {/* 2 · Level */}
      <fieldset disabled={person?.level === "owner"}>
        <legend className="label">{fixed ? "1" : "2"} · Access level</legend>
        <div className="space-y-2">
          {levels.map((r) => {
            const on = r.key === level;
            const locked = r.key === "admin" && !canMakeAdmins;
            return (
              <button
                key={r.key}
                type="button"
                disabled={locked}
                aria-pressed={on}
                onClick={() => setLevel(r.key as Level)}
                className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-background shadow-inset ring-2 ring-brand-500/60" : "tile"}`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${on ? "bg-brand-500 text-black" : "bg-[#0d0d10] text-white"}`}>{r.icon}</span>
                <span>
                  <span className="block text-sm font-medium">{r.label}{locked && <span className="ml-2 text-[11px] font-normal text-muted">only owners can grant this</span>}</span>
                  <span className="block text-xs text-muted">{r.desc}</span>
                </span>
              </button>
            );
          })}
          <button type="button" aria-pressed={level === "none"} onClick={() => setLevel("none")} className={`w-full rounded-2xl px-3 py-2 text-left text-sm ${level === "none" ? "bg-red-500/10 font-medium text-red-700 ring-2 ring-red-400/50" : "text-muted hover:text-red-600"}`}>
            Remove all access
          </button>
        </div>
      </fieldset>

      {/* 3 · Pages */}
      {scoped && (
        <fieldset>
          <legend className="label">{fixed ? "2" : "3"} · Which pages</legend>
          <button type="button" aria-pressed={all} onClick={() => setAll((v) => !v)} className={`mb-2 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${all ? "bg-[#0d0d10] text-white" : "tile"}`}>
            All pages
            <span className={`text-xs font-normal ${all ? "text-brand-400" : "text-muted"}`}>{all ? "✓ including new ones" : "every page, now and later"}</span>
          </button>
          <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${all ? "pointer-events-none opacity-40" : ""}`}>
            {pages.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((v) => (on ? v.filter((x) => x !== p.id) : [...v, p.id]))}
                  className={`rounded-2xl px-3 py-2.5 text-left transition ${on ? "bg-background shadow-inset ring-2 ring-brand-500/60" : "tile"}`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium"><PageDot prefix={p.prefix} />{p.name}{on && <span className="ml-auto text-brand-600">✓</span>}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted">{p.prefix} · {p.members} {p.members === 1 ? "person" : "people"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="rounded-2xl bg-[#0d0d10] p-4 text-sm text-zinc-300 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]">
        {ready && person ? (
          level === "none" ? (
            <p>Remove <b className="text-white">{person.name}</b>&apos;s access to Zinema OS.</p>
          ) : (
            <p>
              Make <b className="text-white">{person.name}</b> <b className="text-brand-400">{levelLabel}</b>
              {scoped ? <> on <b className="text-white">{all ? "all pages" : pageNames.join(", ")}</b></> : " across every page"}.
            </p>
          )
        ) : (
          <p className="text-zinc-500">Pick a person, an access level{scoped ? " and the pages" : ""}.</p>
        )}
        <button type="submit" disabled={!ready || pending} className="btn mt-3 w-full">{pending ? "Saving…" : "Save access"}</button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
    </form>
  );
}
