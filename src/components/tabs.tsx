"use client";

import { useState } from "react";

export type Tab = { key: string; label: string; count?: number; node: React.ReactNode };

/** Compact tabbed panel. Every panel stays mounted (just hidden) so half-typed forms survive a tab switch. */
export function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <section className="card p-4 md:p-6">
      <div role="tablist" aria-label={label} className="well flex gap-1 overflow-x-auto !rounded-full p-1.5 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={t.key === active}
            onClick={() => setActive(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${t.key === active ? "bg-surface font-medium shadow-raise-sm" : "text-muted hover:text-foreground"}`}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && <span className="rounded-full bg-black/[0.07] px-1.5 text-[11px]">{t.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={t.key !== active} className="pt-5">
          {t.node}
        </div>
      ))}
    </section>
  );
}
