"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui";

export type Me = { name: string; email: string; handle: string | null; photo: string | null; role: string; pages: { name: string; role: string }[] };

/** Account chip in the top bar: who's signed in, with what access, and the way out. */
export function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="tile flex items-center gap-2.5 !rounded-full p-1 md:pr-3.5"
      >
        <span className="relative">
          <Avatar name={me.name} email={me.email} src={me.photo} size={34} ring={false} />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-emerald-500" title="Signed in" />
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-36 truncate text-[13px] font-semibold">{me.name}</span>
          <span className="block text-[11px] text-muted">{me.role}</span>
        </span>
        <svg className="hidden text-muted md:block" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>

      {open && (
        <div role="menu" className="card absolute right-0 top-[calc(100%+10px)] z-40 w-[min(300px,calc(100vw-2rem))] p-2 !shadow-raise-lg">
          <div className="flex items-center gap-3 p-3">
            <Avatar name={me.name} email={me.email} src={me.photo} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{me.name}</p>
              <p className="truncate text-xs text-muted">{me.handle ? `@${me.handle} · ` : ""}{me.email}</p>
            </div>
          </div>
          <div className="well mx-1 mb-2 !rounded-2xl p-3 text-xs">
            <p className="flex items-center gap-2 font-medium"><span className="h-2 w-2 rounded-full bg-emerald-500" />Signed in with Google · {me.role}</p>
            {me.pages.length > 0 && (
              <ul className="mt-2 space-y-1 text-muted">
                {me.pages.map((p) => <li key={p.name + p.role} className="flex justify-between gap-2"><span>{p.name}</span><span>{p.role}</span></li>)}
              </ul>
            )}
          </div>
          {[["/profile", "Your profile"], ["/team", "Team & access"], ["/connect", "Connect AI"], ["/guide", "Guide"]].map(([href, label]) => (
            <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-black/[0.05]">{label}</Link>
          ))}
          <form action="/auth/signout" method="post" className="mt-1 border-t border-black/[0.06] pt-1">
            <button role="menuitem" className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-500/10">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
