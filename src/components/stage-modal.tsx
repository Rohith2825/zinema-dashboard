"use client";

import { useRef } from "react";

/** A column's "expand" button: opens the whole stage in a roomy dialog. */
export function StageModal({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-lg p-1 text-zinc-400 transition hover:bg-black/[0.06] hover:text-black"
        aria-label={`Expand ${title}`}
        title={`Expand ${title}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
        </svg>
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="stage-dialog m-auto w-[min(1100px,calc(100vw-2rem))] rounded-[28px] bg-background p-0 text-foreground shadow-[0_40px_100px_-20px_rgba(0,0,0,0.55)] backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between px-8 pb-4 pt-7">
            <div>
              <p className="eyebrow">Stage</p>
              <h2 className="text-2xl font-semibold">{title} <span className="ml-1 text-base font-normal text-muted">{count} {count === 1 ? "song" : "songs"}</span></h2>
            </div>
            <button type="button" onClick={() => ref.current?.close()} className="btn-ghost !px-3" aria-label="Close">✕</button>
          </header>
          <div className="overflow-y-auto px-8 pb-10 pt-4">{children}</div>
        </div>
      </dialog>
    </>
  );
}
