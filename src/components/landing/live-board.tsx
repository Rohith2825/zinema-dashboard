"use client";

import { useEffect, useState } from "react";
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

/** A working miniature of the song board: every couple of seconds a real release moves to its next stage. */
export function LiveBoard() {
  const [stage, setStage] = useState(START);
  const [last, setLast] = useState(-1);

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

  const moved = last >= 0 ? SONGS[last] : null;
  return (
    <div className="card relative mx-auto max-w-5xl p-3 text-left !shadow-raise-lg md:p-5" aria-hidden="true">
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <i className="h-2.5 w-2.5 rounded-full bg-brand-500" /><i className="h-2.5 w-2.5 rounded-full bg-black/10" /><i className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="ml-3 text-[11px] font-medium text-muted">Song board</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-700"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span>
      </div>

      <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
        {STAGES.map((st, col) => {
          const here = SONGS.map((s, i) => ({ s, i })).filter(({ i }) => stage[i] === col);
          return (
            <div key={st.key} className="well min-h-[7.5rem] !rounded-2xl p-1.5 md:min-h-40 md:p-2">
              <p className="mb-1.5 flex items-center justify-between px-1 text-[8px] font-semibold uppercase tracking-wider text-zinc-600 md:text-[9px]">
                <span className="truncate">{st.label}</span>
                <span className="text-muted">{here.length}</span>
              </p>
              <div className="space-y-1.5">
                {here.map(({ s, i }) => (
                  <div key={s.code} className={`tile flex items-center gap-1.5 !rounded-xl p-1 md:gap-2 md:p-1.5 ${i === last ? "lb-pop ring-2 ring-brand-500/70" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.cover} alt="" loading="lazy" className="h-6 w-6 shrink-0 rounded-md bg-[#0d0d10] object-cover md:h-8 md:w-8 md:rounded-lg" />
                    <span className="min-w-0">
                      <span className="block truncate text-[9px] font-semibold leading-tight md:text-[11px]">{s.title}</span>
                      <span className="hidden font-mono text-[8px] text-muted md:block">{s.code}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* What just happened */}
      <div className="mt-3 flex min-h-9 items-center gap-2.5 rounded-xl bg-[#0b0b0d] px-3 py-2 text-[11px] text-neutral-300 md:text-xs">
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
