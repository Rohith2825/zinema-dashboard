import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogAlt = "Zinema Music — It Just Hits. Zinema OS for Tamil, Hindi, Marathi, Spiritual and Community";

const ORANGE = "#fc7c0f";
const BG = "#eceef2";
const SURFACE = "#f1f2f6";
const DARK = "#d2d5dc";
const PAGES = ["Tamil", "Hindi", "Marathi", "Spiritual", "Community"];

// Deterministic equalizer heights, taller towards the middle (same feel as the sign-in page).
const BARS = Array.from({ length: 48 }, (_, i) => {
  const r = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const centre = 1 - Math.abs(i - 23.5) / 30;
  return Math.round((0.2 + centre * 0.55 + r * 0.25) * 100);
});

/** Shared 1200×630 card for Open Graph and Twitter, in the app's light neumorphic look. */
export async function ogCard() {
  const logo = await readFile(join(process.cwd(), "public/brand/zinema-logo-ink.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", alignItems: "center", justifyContent: "center", background: BG, color: "#0d0d10", fontFamily: "sans-serif", overflow: "hidden" }}>
        {/* Soft warmth + raised sound rings */}
        <div style={{ position: "absolute", left: 200, top: -85, width: 800, height: 800, display: "flex", borderRadius: 800, backgroundImage: "radial-gradient(circle, rgba(252,124,15,0.2), rgba(252,124,15,0.04) 45%, transparent 68%)" }} />
        {[1040, 780].map((d) => (
          <div key={d} style={{ position: "absolute", left: 600 - d / 2, top: 290 - d / 2, width: d, height: d, display: "flex", borderRadius: d, boxShadow: `10px 10px 24px ${DARK}, -10px -10px 24px #ffffff` }} />
        ))}

        {/* Equalizer along the bottom */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, display: "flex", alignItems: "flex-end", padding: "0 6px" }}>
          {BARS.map((h, i) => (
            <div key={i} style={{ display: "flex", flex: 1, marginRight: i === BARS.length - 1 ? 0 : 6, height: `${h}%`, borderRadius: "8px 8px 0 0", backgroundImage: `linear-gradient(to top, ${ORANGE}, #ffd9b5)` }} />
          ))}
        </div>

        {/* Raised card */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginTop: -60, padding: "46px 70px 40px", borderRadius: 48, background: SURFACE, border: "2px solid rgba(255,255,255,0.8)", boxShadow: `22px 22px 50px ${DARK}, -22px -22px 50px #ffffff` }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={src} width={520} height={190} />
          <div style={{ display: "flex", marginTop: 30, fontSize: 24, color: "#6c7079" }}>Every song, from first lyric to live.</div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 19, color: "#6c7079" }}>
            {PAGES.map((p, i) => (
              <span key={p} style={{ display: "flex" }}>
                {i > 0 && <span style={{ color: ORANGE, margin: "0 12px" }}>·</span>}
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    ogSize,
  );
}
