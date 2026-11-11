"use client";

import { useRef, useState } from "react";
import { finishUpload, startUpload } from "@/app/actions";

type Props = { deliverableId?: string; coverForSong?: string; label?: string; accept?: string; withNote?: boolean };

/** Uploads a file straight from the browser into the song's Google Drive folder, then records it. */
export function DriveUpload({ deliverableId, coverForSong, label = "Upload a file", accept, withNote = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ phase: "idle" | "busy" | "done" | "error"; pct?: number; msg?: string; name?: string }>({ phase: "idle" });

  async function upload(file: File) {
    const target = { deliverableId, coverForSong };
    setState({ phase: "busy", pct: 0, name: file.name });
    const start = await startUpload(target, { name: file.name, type: file.type || "application/octet-stream", size: file.size });
    if (start.error || !start.sessionUrl) return setState({ phase: "error", msg: start.error ?? "Couldn't start the upload." });

    const fileId = await new Promise<string | null>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", start.sessionUrl!);
      xhr.upload.onprogress = (e) => e.lengthComputable && setState({ phase: "busy", pct: Math.round((e.loaded / e.total) * 100), name: file.name });
      xhr.onload = () => {
        try {
          resolve(xhr.status < 300 ? (JSON.parse(xhr.responseText).id as string) : null);
        } catch {
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      xhr.send(file);
    });
    if (!fileId) return setState({ phase: "error", msg: "The upload to Google Drive didn't finish. Check your connection and try again." });

    const done = await finishUpload(target, fileId, start.folderId!, note);
    if (done?.error) return setState({ phase: "error", msg: done.error });
    setNote("");
    setState({ phase: "done", msg: done?.ok ?? "Uploaded." });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        {withNote && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the checker (optional)" className="input min-w-0 flex-1" />}
        <button type="button" disabled={state.phase === "busy"} onClick={() => input.current?.click()} className="btn-ghost">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
          </svg>
          {state.phase === "busy" ? "Uploading…" : label}
        </button>
      </div>
      {state.phase === "busy" && (
        <div role="status" className="text-xs text-muted">
          <div className="well h-2 overflow-hidden !rounded-full">
            <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${state.pct ?? 0}%` }} />
          </div>
          <p className="mt-1 truncate">{state.name} · {state.pct ?? 0}% · going to Google Drive</p>
        </div>
      )}
      {state.phase === "error" && <p className="text-xs text-red-600">{state.msg}</p>}
      {state.phase === "done" && <p className="text-xs text-emerald-700">{state.msg}</p>}
    </div>
  );
}
