import Link from "next/link";
import type { Page } from "@/lib/types";

const TONES = {
  zinc: "bg-black/[0.05] text-zinc-700",
  violet: "bg-brand-500/15 text-brand-800",
  green: "bg-emerald-500/15 text-emerald-800",
  amber: "bg-amber-500/15 text-amber-800",
  red: "bg-red-500/15 text-red-700",
  blue: "bg-sky-500/15 text-sky-800",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>{children}</span>;
}

export const VERSION_TONE: Record<string, Tone> = {
  submitted: "blue",
  in_review: "blue",
  changes_requested: "amber",
  approved: "green",
  superseded: "zinc",
};
export const VERSION_LABEL: Record<string, string> = {
  submitted: "Waiting for check",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  superseded: "Replaced",
};

export function PageTitle({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Page filter as plain links: keeps the other query params. */
export function PageTabs({ pages, current, base, extra = {} }: { pages: Page[]; current?: string; base: string; extra?: Record<string, string | undefined> }) {
  const href = (slug?: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    if (slug) q.set("page", slug);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const tab = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm transition ${active ? "bg-[#0d0d10] font-medium text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,0.7)]" : "text-zinc-600 hover:text-black"}`;
  return (
    <div className="well mb-6 inline-flex max-w-full flex-wrap gap-1 !rounded-full p-1.5">
      <Link href={href()} className={tab(!current)}>All pages</Link>
      {pages.map((p) => (
        <Link key={p.id} href={href(p.slug)} className={tab(current === p.slug)}>
          {p.name.replace("Zinema.music ", "").replace("Zinema.music", "Main")}
        </Link>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="well p-8 text-center text-sm text-muted">{children}</p>;
}

export const pageShort = (name?: string | null) => (name ?? "").replace("Zinema.music ", "").replace("Zinema.music", "Main");

/** One colour per page, keyed by its song-code prefix. */
export const PAGE_COLOR: Record<string, string> = {
  ZIN: "#fafafa",
  TAM: "#fc7c0f",
  HIN: "#e11d48",
  MAR: "#0ea5e9",
  SPI: "#a855f7",
  COM: "#22c55e",
};
export const pageColor = (prefix?: string | null) => PAGE_COLOR[prefix ?? ""] ?? "#a1a1aa";

export function PageDot({ prefix, className = "" }: { prefix?: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${className}`}
      style={{ background: pageColor(prefix) }}
    />
  );
}

const AVATAR_BG = ["#fc7c0f", "#18181b", "#b85400", "#3f3f46", "#e06800", "#52525b"];

/** Initials avatar; colour is stable per person. */
export function Avatar({ name, email, size = 40, ring = true }: { name?: string | null; email?: string | null; size?: number; ring?: boolean }) {
  const label = (name || email || "?").trim();
  const parts = label.split(/[\s@._-]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
  let h = 0;
  for (const ch of email ?? label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AVATAR_BG[h % AVATAR_BG.length];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${ring ? "shadow-raise-sm" : ""}`}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38, color: bg === "#fc7c0f" || bg === "#e06800" ? "#000" : "#fff" }}
    >
      {initials}
    </span>
  );
}

/** "Zinema Original" (orange) or "Community" (neutral) tag. */
export function OwnershipTag({ ownership, short = false }: { ownership?: string | null; short?: boolean }) {
  const original = ownership !== "community";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        original ? "bg-black text-white" : "bg-white/90 text-zinc-700 ring-1 ring-black/10"
      }`}
    >
      {original && <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-brand-500" />}
      {original ? (short ? "Original" : "Zinema Original") : "Community"}
    </span>
  );
}
