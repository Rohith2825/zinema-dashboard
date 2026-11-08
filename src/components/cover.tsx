"use client";

import { useState } from "react";
import { pageColor } from "@/components/ui";

/**
 * Song cover: the Drive image when it loads, otherwise a branded placeholder
 * (page colour, song code and a little waveform) so empty catalog entries still look intentional.
 */
export function Cover({ src, code, title, prefix, className = "" }: { src: string | null; code: string; title: string; prefix?: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);
  const colour = pageColor(prefix);
  const bars = Array.from(code + title, (c, i) => 20 + ((c.charCodeAt(0) * (i + 7)) % 70)).slice(0, 18);
  return (
    <div className={`relative aspect-square overflow-hidden bg-black ${className}`}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${title} cover art`} referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col justify-between p-3" style={{ background: `radial-gradient(circle at 75% 20%, ${colour}55, transparent 60%), #0a0a0a` }}>
          <span className="font-mono text-[10px] tracking-widest text-white/60">{code}</span>
          <div className="flex h-1/3 items-end gap-[3px]" aria-hidden="true">
            {bars.map((h, i) => <span key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: colour, opacity: 0.35 + (i % 4) * 0.15 }} />)}
          </div>
          <span className="line-clamp-2 text-sm font-semibold leading-tight text-white">{title}</span>
        </div>
      )}
    </div>
  );
}
