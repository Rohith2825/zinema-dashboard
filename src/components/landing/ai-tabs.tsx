"use client";

import { useEffect, useState } from "react";
import { BrandIcon, type Brand } from "./logos";

type Turn = { title: string; you: string; tools: string[]; reply: string[] };
const CHATS: { id: Brand; name: string; soon?: boolean; turn: Turn }[] = [
  {
    id: "claude",
    name: "Claude",
    turn: {
      title: "What's blocking TAM-0005",
      you: "What's blocking TAM-0005 from going to distribution?",
      tools: ["get_song"],
      reply: ["The master WAV is approved, so the audio side is done.", "The artwork has been waiting for a checker since Tuesday. Want me to assign it and nudge them?"],
    },
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    turn: {
      title: "Captions for Digital Mounam",
      you: "Write captions for the three verticals of Digital Mounam and save them to the song's folder.",
      tools: ["get_song", "save_to_drive"],
      reply: ["Done. I wrote one caption per vertical with the credits line and saved them as captions.csv.", "You'll find it in TAM-0005 · Digital Mounam → AI outputs."],
    },
  },
  {
    id: "gemini",
    name: "Gemini",
    soon: true,
    turn: {
      title: "This week's releases",
      you: "What's going live this week?",
      tools: ["calendar"],
      reply: ["Three things are scheduled:", "the Shakti Roop lyric video on Wednesday, two verticals for I Found Love on Friday, and a carousel on Sunday."],
    },
  },
];

const Ic = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const PLUS = "M12 5v14M5 12h14";
const UP = "M12 19V5M6 11l6-6 6 6";
const MIC = "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3";
const COPY = "M9 9h10v10H9zM5 15V5h10";
const UPV = "M7 11v9H4v-9zM7 11l4-8a2 2 0 012 2v4h5a2 2 0 012 2l-1 7a2 2 0 01-2 2H7";
const RETRY = "M4 12a8 8 0 0114-5l2 2M20 4v5h-5M20 12a8 8 0 01-14 5l-2-2M4 20v-5h5";

/** The same Zinema OS conversation, dressed as each assistant's own app. */
export function AiTabs() {
  const [tab, setTab] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTab((t) => (t + 1) % CHATS.length), 5500);
    return () => clearInterval(id);
  }, [touched]);

  const c = CHATS[tab];
  const t = c.turn;
  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Assistants" className="well mb-4 flex max-w-full gap-1 overflow-x-auto !rounded-full p-1.5 [scrollbar-width:none] sm:inline-flex">
        {CHATS.map((x, i) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={i === tab}
            onClick={() => { setTab(i); setTouched(true); }}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${i === tab ? "bg-surface shadow-raise-sm" : "text-muted hover:text-foreground"}`}
          >
            <BrandIcon name={x.id} size={16} />
            {x.name}
            {x.soon && <span className="hidden rounded-full bg-black/[0.06] px-1.5 text-[10px] font-normal text-muted sm:inline">soon</span>}
          </button>
        ))}
      </div>

      <div key={c.id} className="lb-fade overflow-hidden rounded-[22px] border border-black/[0.06] shadow-raise-lg" aria-hidden="true">
        {/* ── Claude ── */}
        {c.id === "claude" && (
          <div className="flex min-h-[400px] flex-col bg-[#faf9f5] text-[#29261b]">
            <div className="flex items-center gap-2 border-b border-[#e8e6dc] px-4 py-3 text-[13px]">
              <span className="truncate font-medium">{t.title}</span>
              <span className="ml-auto shrink-0 rounded-md border border-[#e0ddd0] px-2 py-0.5 text-[11px] text-[#73726c]">Share</span>
            </div>
            <div className="flex-1 space-y-4 px-4 py-5 sm:px-6">
              <div className="ml-auto flex w-fit max-w-[88%] items-start gap-2 rounded-xl bg-[#f0eee6] px-3 py-2.5 text-[14px] leading-snug">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3d3d3a] text-[10px] font-semibold text-white">R</span>
                <span className="pt-0.5">{t.you}</span>
              </div>
              <div className="space-y-3">
                {t.tools.map((n) => (
                  <p key={n} className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-[#e0ddd0] bg-white/60 px-2.5 py-1.5 text-[12px] text-[#5c5b55]">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center bg-brand-500 text-[9px] font-bold text-black">Z</span>
                    <span className="truncate">Zinema OS · <span className="font-mono">{n}</span></span>
                    <span className="text-[#a3a29b]">›</span>
                  </p>
                ))}
                <div style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }} className="space-y-2 text-[15.5px] leading-relaxed">
                  {t.reply.map((r) => <p key={r}>{r}</p>)}
                </div>
                <p className="flex items-center gap-3 text-[#a3a29b]"><BrandIcon name="claude" size={20} /><Ic d={COPY} size={14} /><Ic d={UPV} size={14} /><Ic d={RETRY} size={14} /></p>
              </div>
            </div>
            <div className="mx-3 mb-3 rounded-2xl border border-[#e0ddd0] bg-white px-4 pb-2.5 pt-3 shadow-sm sm:mx-5">
              <p className="text-[14px] text-[#a3a29b]">Reply to Claude…</p>
              <div className="mt-3 flex items-center gap-2 text-[#73726c]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e0ddd0]"><Ic d={PLUS} size={14} /></span>
                <span className="flex items-center gap-1.5 rounded-lg border border-[#e0ddd0] px-2 py-1 text-[11px]"><span className="h-2 w-2 bg-brand-500" />Zinema OS</span>
                <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-[#d97757] text-white"><Ic d={UP} size={14} /></span>
              </div>
            </div>
          </div>
        )}

        {/* ── ChatGPT ── */}
        {c.id === "chatgpt" && (
          <div className="flex min-h-[400px] flex-col bg-white text-[#0d0d0d]">
            <div className="flex items-center gap-1.5 px-4 py-3 text-[15px] font-medium">
              ChatGPT <span className="text-[#8f8f8f]">⌄</span>
              <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#f4f4f4] text-[11px] font-semibold">R</span>
            </div>
            <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
              <div className="ml-auto w-fit max-w-[85%] rounded-[20px] bg-[#f4f4f4] px-4 py-2.5 text-[14.5px] leading-snug">{t.you}</div>
              <div className="space-y-3">
                {t.tools.map((n) => (
                  <p key={n} className="flex items-center gap-2 text-[13px] text-[#6f6f6f]">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-brand-500 text-[9px] font-bold text-black">Z</span>
                    <span className="truncate">Called Zinema OS · <span className="font-mono">{n}</span></span>
                  </p>
                ))}
                <div className="space-y-2 text-[15px] leading-relaxed">{t.reply.map((r) => <p key={r}>{r}</p>)}</div>
                <p className="flex items-center gap-3 text-[#8f8f8f]"><Ic d={COPY} size={15} /><Ic d={UPV} size={15} /><Ic d={RETRY} size={15} /></p>
              </div>
            </div>
            <div className="mx-3 mb-3 flex items-center gap-2 rounded-[26px] border border-[#e5e5e5] px-3 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:mx-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#5d5d5d]"><Ic d={PLUS} /></span>
              <span className="flex-1 truncate text-[15px] text-[#8f8f8f]">Ask anything</span>
              <span className="text-[#5d5d5d]"><Ic d={MIC} /></span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-white"><Ic d={UP} size={15} /></span>
            </div>
          </div>
        )}

        {/* ── Gemini ── */}
        {c.id === "gemini" && (
          <div className="flex min-h-[400px] flex-col bg-white text-[#1f1f1f]">
            <div className="flex items-center gap-2 px-4 py-3 text-[17px] text-[#444746]">
              Gemini
              <span className="rounded-full bg-[#f0f4f9] px-2 py-0.5 text-[11px] text-[#5f6368]">Coming soon to Zinema OS</span>
              <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#0b57d0] text-[11px] font-semibold text-white">R</span>
            </div>
            <div className="flex-1 space-y-5 px-4 py-4 sm:px-6">
              <div className="ml-auto w-fit max-w-[85%] rounded-[20px] rounded-tr-md bg-[#f0f4f9] px-4 py-2.5 text-[14.5px] leading-snug">{t.you}</div>
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0"><BrandIcon name="gemini" size={22} mono="#4285F4" /></span>
                <div className="min-w-0 space-y-3">
                  {t.tools.map((n) => (
                    <p key={n} className="flex w-fit max-w-full items-center gap-2 rounded-full bg-[#f0f4f9] px-3 py-1 text-[12px] text-[#444746]">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-brand-500 text-[9px] font-bold text-black">Z</span>
                      <span className="truncate">Zinema OS · <span className="font-mono">{n}</span></span>
                    </p>
                  ))}
                  <div className="space-y-2 text-[15px] leading-relaxed">{t.reply.map((r) => <p key={r}>{r}</p>)}</div>
                  <p className="flex items-center gap-3 text-[#5f6368]"><Ic d={UPV} size={15} /><Ic d={RETRY} size={15} /><Ic d={COPY} size={15} /></p>
                </div>
              </div>
            </div>
            <div className="mx-3 mb-3 flex items-center gap-2 rounded-[28px] bg-[#f0f4f9] px-4 py-3 sm:mx-5">
              <span className="text-[#444746]"><Ic d={PLUS} /></span>
              <span className="flex-1 truncate text-[15px] text-[#5f6368]">Ask Gemini</span>
              <span className="text-[#444746]"><Ic d={MIC} /></span>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Illustrative conversations. Claude and ChatGPT connect today; Gemini is coming soon.</p>
    </div>
  );
}
