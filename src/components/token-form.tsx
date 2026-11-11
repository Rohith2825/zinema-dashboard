"use client";

import { useActionState, useState } from "react";
import { createMcpToken } from "@/app/actions";

export function CopyBox({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="well flex items-center gap-2 !rounded-2xl p-2 pl-4">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
      <button
        type="button"
        className="btn-ghost !py-1.5 text-xs"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : (label ?? "Copy")}
      </button>
    </div>
  );
}

export function TokenForm() {
  const [state, action, pending] = useActionState(createMcpToken, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        <input name="name" placeholder="e.g. Claude Code on my laptop" className="input" required />
        <button className="btn-dark" disabled={pending}>{pending ? "Creating…" : "Create token"}</button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.token && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-emerald-700">{state.ok}</p>
          <CopyBox value={state.token} label="Copy token" />
        </div>
      )}
    </form>
  );
}
