"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * App-wide navigation feedback. Starts the moment someone clicks an internal link (page tabs, calendar views,
 * sidebar, cards) or submits a GET form, and stops when the new URL has rendered.
 * Shows an orange progress bar, dims the current screen, and floats a little equalizer "Loading" pill.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = search ? `${pathname}?${search}` : pathname;
  // The URL we were on when the click happened; once the rendered URL differs, loading is over.
  const [leaving, setLeaving] = useState<string | null>(null);
  const pending = leaving !== null && leaving === current;
  const clicked = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Same shape as `current` (pathname + normalised query) so the two compare reliably.
    const key = (u: { pathname: string; search: string }) => {
      const q = new URLSearchParams(u.search).toString();
      return q ? `${u.pathname}?${q}` : u.pathname;
    };
    const here = () => key(location);
    const start = (url: URL) => {
      if (url.origin !== location.origin) return;
      if (key(url) === here()) return; // same screen (or hash-only)
      setLeaving(here());
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      start(new URL(a.href, location.href));
      clicked.current?.removeAttribute("data-nav-pending");
      clicked.current = a;
      a.setAttribute("data-nav-pending", "");
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (e.defaultPrevented || form.method.toLowerCase() !== "get" || typeof form.getAttribute("action") !== "string") return;
      const url = new URL(form.getAttribute("action") || location.pathname, location.href);
      url.search = new URLSearchParams(new FormData(form) as unknown as Record<string, string>).toString();
      start(url);
    };
    const onPop = () => setLeaving(null);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // Safety net: never spin forever.
  useEffect(() => {
    if (!pending) return;
    document.documentElement.dataset.navigating = "";
    const t = setTimeout(() => setLeaving(null), 15000);
    return () => {
      clearTimeout(t);
      delete document.documentElement.dataset.navigating;
      clicked.current?.removeAttribute("data-nav-pending");
      clicked.current = null;
    };
  }, [pending]);

  if (!pending) return null;
  return (
    <>
      <div className="nav-bar" aria-hidden="true" />
      <div role="status" aria-live="polite" className="nav-pill">
        <span className="eq-loader" aria-hidden="true"><i /><i /><i /><i /></span>
        Loading
      </div>
    </>
  );
}
