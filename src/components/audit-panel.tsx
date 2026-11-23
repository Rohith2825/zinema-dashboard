"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type AuditRun = {
  verdict: string; skill: string; report_md: string | null; created_at: string;
  findings: { check: string; status: string; value: string; target: string; fix?: string }[] | null;
};

const DOT: Record<string, string> = { pass: "bg-emerald-500", warn: "bg-amber-500", fail: "bg-red-500", info: "bg-zinc-300" };
const HEAD: Record<string, { text: string; cls: string }> = {
  pass: { text: "Passed", cls: "text-emerald-700" },
  warn: { text: "Usable, with things to look at", cls: "text-amber-700" },
  fail: { text: "Needs fixing", cls: "text-red-700" },
  error: { text: "Couldn't be checked", cls: "text-red-700" },
};
const WAIT: Record<string, string> = {
  "Mix audit": "Measuring loudness, peaks and clipping. A full master takes up to a minute.",
  "Artwork audit": "Checking size and colour, then looking at the cover. About half a minute.",
  "Lyric review": "Reading the lyric. About a minute.",
};

/** Notes written by the reviewer (kept after the checklist in the saved report). */
function Notes({ md }: { md: string }) {
  const start = md.search(/^### (?!What to fix)/m);
  if (start < 0) return null;
  const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
  const blocks = md.slice(start).split(/\n(?=### )/);
  return (
    <div className="mt-4 space-y-3 border-t border-black/5 pt-4">
      {blocks.map((b, i) => {
        const [head, ...rest] = b.trim().split("\n");
        const lines = rest.filter((l) => l.trim());
        return (
          <div key={i}>
            <p className="eyebrow mb-1">{head.replace(/^### /, "")}</p>
            {lines.every((l) => l.startsWith("- ")) ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">{lines.map((l, j) => <li key={j}>{bold(l.slice(2))}</li>)}</ul>
            ) : lines.every((l) => l.startsWith(">")) ? (
              <p className="well whitespace-pre-line px-3 py-2 text-sm">{lines.map((l) => l.replace(/^> ?/, "")).join("\n")}</p>
            ) : (
              <p className="whitespace-pre-line text-sm">{bold(lines.join("\n"))}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The audit for one submitted file: a button to run it, and the result as a checklist. */
export function AuditPanel({ versionId, label, canRun, audit }: { versionId: string; label: string; canRun: boolean; audit?: AuditRun }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version_id: versionId }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) setError(json?.error ?? "The audit couldn't finish. Try again.");
      else startRefresh(() => router.refresh());
    } catch {
      setError("The audit couldn't finish. Check your connection and try again.");
    }
    setBusy(false);
  }

  const working = busy || refreshing;
  const findings = audit?.findings ?? [];
  const head = audit ? HEAD[audit.verdict] ?? HEAD.error : null;
  const problems = findings.filter((f) => f.status === "fail" || f.status === "warn").length;

  return (
    <div className="w-full">
      {audit && head && (
        <details className="well px-3 py-2.5" open={audit.verdict === "fail"}>
          <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[audit.verdict] ?? DOT.fail}`} />
            <span className="font-medium">{label}:</span>
            <span className={head.cls}>{head.text}</span>
            <span className="text-xs text-muted">{problems ? `${problems} to look at · ` : ""}tap for details</span>
          </summary>
          <ul className="mt-3 space-y-2.5">
            {findings.map((f, i) => (
              <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)] gap-x-2.5 text-sm">
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${DOT[f.status] ?? DOT.info}`} />
                <div className="min-w-0">
                  <p>
                    <span className="font-medium">{f.check}</span>{" "}
                    <span className="break-words">{f.value}</span>
                    {f.status !== "info" && f.target !== "AI opinion" && <span className="text-xs text-muted"> · target {f.target}</span>}
                    {f.target === "AI opinion" && <span className="text-xs text-muted"> · AI opinion</span>}
                  </p>
                  {f.fix && <p className="mt-0.5 text-xs text-zinc-600">{f.fix}</p>}
                </div>
              </li>
            ))}
          </ul>
          {audit.report_md && <Notes md={audit.report_md} />}
          <p className="mt-3 text-[11px] text-muted">This is a recommendation. The checker still decides.</p>
        </details>
      )}
      {canRun && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={run} disabled={working} className="btn-ghost">
            {working && <span className="eq-loader" aria-hidden="true"><i /><i /><i /><i /></span>}
            {working ? "Checking…" : audit ? `Run ${label.toLowerCase()} again` : `Run ${label.toLowerCase()}`}
          </button>
          {working && <span role="status" className="text-xs text-muted">{WAIT[label]}</span>}
          {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
