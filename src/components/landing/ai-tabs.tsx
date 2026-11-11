"use client";

import { useEffect, useState } from "react";
import { BrandIcon, type Brand } from "./logos";

type Turn = { you: string; tool: string[]; reply: string };
const CHATS: { id: Brand; name: string; status: string; turn: Turn }[] = [
  {
    id: "claude",
    name: "Claude",
    status: "Supported",
    turn: {
      you: "What's blocking TAM-0005 from going to distribution?",
      tool: ["get_song"],
      reply: "The master WAV is approved. The artwork has been waiting for a checker since Tuesday. Want me to assign it and nudge them?",
    },
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    status: "Supported",
    turn: {
      you: "Write captions for the three verticals of Digital Mounam and save them to the song's folder.",
      tool: ["get_song", "save_to_drive"],
      reply: "Done. captions.csv is in TAM-0005 · Digital Mounam → AI outputs, with one caption per vertical and the credits line.",
    },
  },
  {
    id: "gemini",
    name: "Gemini",
    status: "Coming soon",
    turn: {
      you: "What's going live this week?",
      tool: ["calendar"],
      reply: "Three things: the Shakti Roop lyric video on Wednesday, two verticals for I Found Love on Friday, and a carousel on Sunday.",
    },
  },
];

const Tool = ({ names, className }: { names: string[]; className: string }) => (
  <p className="flex flex-wrap gap-1.5">
    {names.map((n) => (
      <span key={n} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] ${className}`}>
        <i className="h-1.5 w-1.5 bg-brand-500" />zinema-os · {n}
      </span>
    ))}
  </p>
);

/** The same Zinema OS conversation, dressed as each assistant's own app. */
export function AiTabs() {
  const [tab, setTab] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTab((t) => (t + 1) % CHATS.length), 5000);
    return () => clearInterval(id);
  }, [touched]);

  const c = CHATS[tab];
  return (
    <div>
      <div role="tablist" aria-label="Assistants" className="well mb-4 inline-flex gap-1 !rounded-full p-1.5">
        {CHATS.map((x, i) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={i === tab}
            onClick={() => { setTab(i); setTouched(true); }}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${i === tab ? "bg-surface shadow-raise-sm" : "text-muted hover:text-foreground"}`}
          >
            <BrandIcon name={x.id} size={16} />
            {x.name}
          </button>
        ))}
      </div>

      <div key={c.id} className="lb-fade overflow-hidden rounded-[26px] shadow-raise-lg" aria-hidden="true">
        {c.id === "claude" && (
          <div className="bg-[#f5f0e8] p-5 text-[#3d3929] md:p-7">
            <p className="mb-5 flex items-center gap-2 text-sm font-medium"><BrandIcon name="claude" size={18} />Claude <span className="ml-auto rounded-full bg-[#d97757]/15 px-2 py-0.5 text-[10px] text-[#b8532f]">Zinema OS connected</span></p>
            <div className="ml-auto w-fit max-w-[88%] rounded-2xl bg-[#e8e0d0] px-4 py-2.5 text-sm">{c.turn.you}</div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              <Tool names={c.turn.tool} className="bg-white/70 text-[#6b6453]" />
              <p style={{ fontFamily: "Georgia, 'Times New Roman', serif" }} className="text-[15px]">{c.turn.reply}</p>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#d9d0bd] bg-white px-4 py-3 text-sm text-[#a39a86]">Reply to Claude…<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d97757] text-white">↑</span></div>
          </div>
        )}
        {c.id === "chatgpt" && (
          <div className="bg-white p-5 text-[#0d0d0d] md:p-7">
            <p className="mb-5 flex items-center gap-2 text-sm font-semibold"><BrandIcon name="chatgpt" size={18} />ChatGPT <span className="ml-auto rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-normal text-zinc-600">Zinema OS connected</span></p>
            <div className="ml-auto w-fit max-w-[88%] rounded-3xl bg-[#f4f4f4] px-4 py-2.5 text-sm">{c.turn.you}</div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              <Tool names={c.turn.tool} className="bg-[#f4f4f4] text-zinc-600" />
              <p>{c.turn.reply}</p>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-full border border-zinc-200 px-5 py-3 text-sm text-zinc-400 shadow-sm">Ask anything<span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white">↑</span></div>
          </div>
        )}
        {c.id === "gemini" && (
          <div className="bg-[#f0f4f9] p-5 text-[#1f1f1f] md:p-7">
            <p className="mb-5 flex items-center gap-2 text-sm font-medium"><BrandIcon name="gemini" size={18} mono="#4285F4" />Gemini <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] text-zinc-500">Coming soon</span></p>
            <div className="ml-auto w-fit max-w-[88%] rounded-3xl rounded-tr-md bg-[#e9eef6] px-4 py-2.5 text-sm">{c.turn.you}</div>
            <div className="mt-4 flex gap-3 text-sm leading-relaxed">
              <span className="mt-0.5 shrink-0"><BrandIcon name="gemini" size={20} mono="#4285F4" /></span>
              <div className="space-y-3">
                <Tool names={c.turn.tool} className="bg-white text-zinc-600" />
                <p>{c.turn.reply}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-full bg-white px-5 py-3 text-sm text-zinc-400">Ask Gemini<span className="text-[#4285F4]">➤</span></div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Illustrative conversations. Claude and ChatGPT connect today; more assistants as they add support.</p>
    </div>
  );
}
