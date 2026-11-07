"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/board", label: "Board" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks" },
  { href: "/inbox", label: "Inbox" },
  { href: "/team", label: "Team" },
];

export function Nav({ unread = 0 }: { unread?: number }) {
  return <NavLinks path={usePathname()} unread={unread} />;
}

/** Presentational links (usable as a Suspense fallback with no path). */
export function NavLinks({ path, unread = 0 }: { path: string; unread?: number }) {
  return (
    <nav className="flex gap-1 md:flex-col">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/") || (l.href === "/board" && path.startsWith("/songs"));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
              active ? "bg-violet-50 font-medium text-violet-800" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {l.label}
            {l.href === "/inbox" && unread > 0 && (
              <span className="ml-2 rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold text-white">{unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
