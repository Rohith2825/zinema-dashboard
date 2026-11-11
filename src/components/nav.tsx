"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const I = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const GROUPS = [
  {
    label: "Pipeline",
    links: [
      { href: "/board", label: "Board", icon: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z" },
      { href: "/catalog", label: "Catalog", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
      { href: "/calendar", label: "Calendar", icon: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4" },
      { href: "/tasks", label: "Tasks", icon: "M4 7l2 2 3-4M4 16l2 2 3-4M13 7h7M13 17h7" },
    ],
  },
  {
    label: "Workspace",
    links: [
      { href: "/inbox", label: "Inbox", icon: "M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5" },
      { href: "/attendance", label: "Attendance", icon: "M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" },
      { href: "/team", label: "Team", icon: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 010 6M18 15c2 .6 3 2.300 3 5" },
      { href: "/connect", label: "Connect AI", icon: "M9 3v5M15 3v5M7 8h10v4a5 5 0 01-10 0zM12 17v4" },
      { href: "/help", label: "Guide", icon: "M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h10" },
    ],
  },
];

export function Nav({ unread = 0 }: { unread?: number }) {
  return <NavLinks path={usePathname()} unread={unread} />;
}

/** Presentational links (usable as a Suspense fallback with no path). */
export function NavLinks({ path, unread = 0 }: { path: string; unread?: number }) {
  return (
    <nav className="flex gap-1 md:flex-col md:gap-6">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex gap-1 md:flex-col">
          <p className="mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-600 md:block">{g.label}</p>
          {g.links.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/") || (l.href === "/board" && path.startsWith("/songs"));
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? "bg-white/[0.08] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className={active ? "text-brand-500" : "text-neutral-500 group-hover:text-neutral-300"}><I d={l.icon} /></span>
                <span className="whitespace-nowrap">{l.label}</span>
                {l.href === "/inbox" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-black">{unread}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Phone navigation: four main tabs plus "More" for everything else. The More sheet closes on any choice, on a tap outside, and on Escape. */
export function MobileTabs({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
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

  const all = GROUPS.flatMap((g) => g.links);
  const main = all.slice(0, 4);
  const rest = all.slice(4);
  const is = (href: string) => path === href || path.startsWith(href + "/") || (href === "/board" && path.startsWith("/songs"));
  const restActive = rest.some((l) => is(l.href));
  const item = (active: boolean) => `flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium ${active ? "text-white" : "text-neutral-500"}`;
  return (
    <nav ref={ref} className="fixed inset-x-3 bottom-3 z-30 md:hidden" aria-label="Main">
      <div className="relative flex items-stretch rounded-[26px] bg-[#0b0b0d]/95 px-2 py-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur">
        {main.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} aria-current={is(l.href) ? "page" : undefined} className={item(is(l.href))}>
            <span className={is(l.href) ? "text-brand-500" : ""}><I d={l.icon} /></span>
            {l.label}
          </Link>
        ))}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className={`${item(restActive || open)} relative`}>
          <span className={restActive || open ? "text-brand-500" : ""}><I d="M5 12h.01M12 12h.01M19 12h.01" /></span>
          More
          {unread > 0 && <span className="absolute right-3 top-1 h-2 w-2 rounded-full bg-brand-500" />}
        </button>
        {open && (
          <div role="menu" className="lb-fade absolute bottom-[calc(100%+10px)] right-0 w-56 rounded-3xl bg-[#0b0b0d] p-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]">
            {rest.map((l) => (
              <Link key={l.href} href={l.href} role="menuitem" onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${is(l.href) ? "bg-white/10 text-white" : "text-neutral-300"}`}>
                <span className={is(l.href) ? "text-brand-500" : "text-neutral-500"}><I d={l.icon} /></span>
                {l.label}
                {l.href === "/inbox" && unread > 0 && <span className="ml-auto rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-black">{unread}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
