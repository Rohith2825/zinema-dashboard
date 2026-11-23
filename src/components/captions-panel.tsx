"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type CaptionSet = {
  instagram?: { caption: string; hashtags: string[] };
  youtube?: { title: string; description: string };
  shorts?: { title: string; description: string };
  x?: { post: string };
  on_screen_hooks?: string[];
  romanised_instagram_caption?: string;
};

function Block({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="tile p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="eyebrow">{title}</p>
        <button
          type="button"
          className="text-xs font-medium text-brand-700"
          onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="whitespace-pre-line break-words text-sm">{text}</p>
    </div>
  );
}

/** Caption drafts for every platform, written by the AI and copied out by a person. */
export function CaptionsPanel({ code, canWrite, enabled, latest, when, by }: { code: string; canWrite: boolean; enabled: boolean; latest?: CaptionSet | null; when?: string; by?: string }) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const working = busy || refreshing;

  async function write() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/captions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, brief }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) setError(json?.error ?? "Couldn't write the captions. Try again.");
      else startRefresh(() => router.refresh());
    } catch {
      setError("Couldn't write the captions. Check your connection and try again.");
    }
    setBusy(false);
  }

  const c = latest;
  const tags = c?.instagram?.hashtags?.map((h) => `#${h.replace(/^#/, "")}`).join(" ") ?? "";
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={600} placeholder="Anything to focus on? e.g. release day, festival, behind the scenes (optional)" className="input min-w-0 flex-1" />
            <button type="button" onClick={write} disabled={working || !enabled} className="btn">
              {working && <span className="eq-loader" aria-hidden="true"><i /><i /><i /><i /></span>}
              {working ? "Writing…" : c ? "Write new captions" : "Write captions"}
            </button>
          </div>
          {working && <p role="status" className="text-xs text-muted">Writing captions for Instagram, YouTube and X. About a minute.</p>}
          {!enabled && <p className="text-xs text-muted">The caption writer here needs the AI key (an admin adds it). Until then, ask Claude or ChatGPT through Connect: “write captions for {code}”.</p>}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>
      )}
      {!c && <p className="text-sm text-muted">No captions yet.</p>}
      {c && (
        <>
          <p className="text-xs text-muted">Draft{by ? ` by ${by}` : ""}{when ? ` · ${when}` : ""}. Read it before posting: check names and links.</p>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
            <Block title="Instagram caption" text={[c.instagram?.caption, tags].filter(Boolean).join("\n\n")} />
            <Block title="Instagram caption (English letters)" text={c.romanised_instagram_caption ?? ""} />
            <Block title="YouTube title" text={c.youtube?.title ?? ""} />
            <Block title="YouTube description" text={c.youtube?.description ?? ""} />
            <Block title="Shorts title" text={c.shorts?.title ?? ""} />
            <Block title="Shorts description" text={c.shorts?.description ?? ""} />
            <Block title="X post" text={c.x?.post ?? ""} />
            <Block title="Text on screen (first second of a reel)" text={(c.on_screen_hooks ?? []).join("\n")} />
          </div>
        </>
      )}
    </div>
  );
}
