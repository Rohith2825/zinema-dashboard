"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const I = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const GROUPS = [
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
      { href: "/guide", label: "Guide", icon: "M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h10" },
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
