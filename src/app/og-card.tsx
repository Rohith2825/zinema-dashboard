import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogAlt = "Zinema Music — It Just Hits. Zinema OS for Tamil, Hindi, Marathi, Spiritual and Indie";

const ORANGE = "#fc7c0f";
const PAGES = ["Tamil", "Hindi", "Marathi", "Spiritual", "Indie"];

// Deterministic equalizer heights, taller towards the middle (same feel as the login page).
const BARS = Array.from({ length: 60 }, (_, i) => {
  const r = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const centre = 1 - Math.abs(i - 29.5) / 38;
  return Math.round((0.18 + centre * 0.6 + r * 0.25) * 100);
});

function wavePath(seed: number, amp: number) {
  const pts: string[] = [];
  for (let x = 0; x <= 1200; x += 6) {
    const t = (x / 1200) * Math.PI * 2;
    const y = 60 + Math.sin(t * 3 + seed) * amp * Math.sin(t + seed) + Math.sin(t * 11 + seed) * (amp / 2.5) * Math.cos(t * 2);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

/** Shared 1200×630 card for Open Graph and Twitter: a still of the login page (logo, sound rings, waveform, EQ). */
export async function ogCard() {
  const logo = await readFile(join(process.cwd(), "public/brand/zinema-logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          backgroundImage: "radial-gradient(circle at 50% 46%, rgba(252,124,15,0.32), rgba(252,124,15,0.08) 32%, transparent 62%)",
          color: "#fff",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Sound rings */}
        {[300, 520, 760, 1020].map((d, i) => (
          <div
            key={d}
            style={{
              position: "absolute",
              left: 600 - d / 2,
              top: 290 - d / 2,
              width: d,
              height: d,
              display: "flex",
              borderRadius: d,
              border: `${i === 0 ? 2 : 1.5}px solid rgba(252,124,15,${(0.6 - i * 0.13).toFixed(2)})`,
            }}
          />
        ))}

        {/* Waveforms across the middle */}
        <svg width="1200" height="120" viewBox="0 0 1200 120" style={{ position: "absolute", left: 0, top: 262 }}>
          <path d={wavePath(2.1, 26)} fill="none" stroke="rgba(252,124,15,0.35)" strokeWidth="2" />
          <path d={wavePath(0.6, 20)} fill="none" stroke="rgba(252,124,15,0.75)" strokeWidth="2.5" />
        </svg>

        {/* Equalizer along the bottom */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 170, display: "flex", alignItems: "flex-end", padding: "0 4px" }}>
          {BARS.map((h, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flex: 1,
                marginRight: i === BARS.length - 1 ? 0 : 4,
                height: `${h}%`,
                borderRadius: "3px 3px 0 0",
                backgroundImage: `linear-gradient(to top, ${ORANGE}, rgba(252,124,15,0.05))`,
              }}
            />
          ))}
        </div>

        {/* Centre stack */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginTop: -70 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={src} width={600} height={220} />
          <div style={{ display: "flex", marginTop: 34, fontSize: 22, letterSpacing: 9, color: "#c4c4c4" }}>
            ZINEMA<span style={{ color: ORANGE, marginLeft: 14, fontWeight: 700 }}>OS</span>
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 22, color: "#8a8a8a" }}>
            {PAGES.map((p, i) => (
              <span key={p} style={{ display: "flex" }}>
                {i > 0 && <span style={{ color: ORANGE, margin: "0 14px" }}>·</span>}
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
