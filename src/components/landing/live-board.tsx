"use client";

import { useEffect, useRef, useState } from "react";
import { STAGES } from "@/lib/types";
import { SONGS } from "./songs";

const START = [0, 1, 2, 2, 3, 4, 5, 6, 7, 7];
const VERB: Record<string, string> = {
  music: "lyrics approved → Music",
  master_qc: "rough mix approved → Mix & Master",
  distribution: "master passed the audit → Distribution",
  video: "ISRC recorded → Video",
  promo: "lyric video approved → Promo",
  posting: "3 carousels + 3 verticals approved → Posting",
  live: "is live on Spotify",
  lyrics: "new song started → Lyrics",
};

/**
 * A working miniature of the song board: every couple of seconds a real release moves to its next stage.
 * The frame never changes size: every column has a fixed width and height, and on phones the eight columns
 * sit in one row you can swipe (it follows the song that just moved until you touch it).
 */
export function LiveBoard() {
  const [stage, setStage] = useState(START);
  const [last, setLast] = useState(-1);
  const strip = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = 0;
    const order = [1, 4, 6, 0, 3, 7, 5, 2, 9, 8];
    const id = setInterval(() => {
      const i = order[n++ % order.length];
      setStage((s) => s.map((v, k) => (k === i ? (v + 1) % STAGES.length : v)));
      setLast(i);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // On phones, keep the column that just received a song in view.
  useEffect(() => {
    const el = strip.current;
    if (!el || last < 0 || touched.current || el.scrollWidth <= el.clientWidth) return;
    const col = el.children[stage[last]] as HTMLElement | undefined;
    if (col) el.scrollTo({ left: col.offsetLeft - (el.clientWidth - col.offsetWidth) / 2, behavior: "smooth" });
  }, [last, stage]);

  const moved = last >= 0 ? SONGS[last] : null;
  return (
    <div className="card relative mx-auto max-w-5xl p-3 text-left !shadow-raise-lg md:p-5" aria-hidden="true">
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <i className="h-2.5 w-2.5 rounded-full bg-brand-500" /><i className="h-2.5 w-2.5 rounded-full bg-black/10" /><i className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="ml-3 text-[11px] font-medium text-muted">Song board</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-700"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span>
      </div>

      <div
        ref={strip}
        onPointerDown={() => { touched.current = true; }}
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-8 lg:overflow-visible lg:px-0"
      >
        {STAGES.map((st, col) => {
          const here = SONGS.map((s, i) => ({ s, i })).filter(({ i }) => stage[i] === col);
          return (
            <div key={st.key} className="well flex h-[232px] w-[136px] shrink-0 flex-col overflow-hidden !rounded-2xl p-2 lg:w-auto">
              <p className="mb-2 flex items-center justify-between px-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                <span className="truncate">{st.label}</span>
                <span className="ml-1 rounded-full bg-black/[0.06] px-1.5 text-muted">{here.length}</span>
              </p>
              <div className="space-y-1.5">
                {here.slice(0, 4).map(({ s, i }) => (
                  <div key={s.code} className={`tile flex h-11 items-center gap-2 !rounded-xl p-1.5 ${i === last ? "lb-pop ring-2 ring-brand-500/70" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.cover} alt="" loading="lazy" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg bg-[#0d0d10] object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold leading-tight">{s.title}</span>
                      <span className="block truncate font-mono text-[8.5px] text-muted">{s.code}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* What just happened (always one line, so the frame never jumps) */}
      <div className="mt-3 flex h-9 items-center gap-2.5 overflow-hidden rounded-xl bg-[#0b0b0d] px-3 text-[11px] text-neutral-300 md:text-xs">
        <span className="eq-loader shrink-0" aria-hidden="true"><i /><i /><i /><i /></span>
        {moved ? (
          <span key={`${moved.code}-${stage[last]}`} className="lb-fade truncate">
            <b className="font-mono text-white">{moved.code}</b> · {moved.title} — {VERB[STAGES[stage[last]].key]}
          </span>
        ) : (
          <span className="truncate">Ten real Zinema releases, moving through the pipeline…</span>
        )}
      </div>
    </div>
  );
}
