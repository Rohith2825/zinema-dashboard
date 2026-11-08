import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogAlt = "Zinema Music — Tamil, Hindi, Marathi, Spiritual and Indie";

const PAGES = ["Tamil", "Hindi", "Marathi", "Spiritual", "Indie"];

/** Shared 1200×630 card for Open Graph and Twitter. */
export function ogCard() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#000", color: "#fff", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <span style={{ fontSize: 150, fontWeight: 800, letterSpacing: -6, lineHeight: 1 }}>zinema</span>
          <span style={{ width: 36, height: 36, background: "#fc7c0f", marginLeft: 14, marginBottom: 18 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 40, color: "#a3a3a3" }}>Music from India</span>
          <div style={{ display: "flex", marginTop: 24 }}>
            {PAGES.map((p) => (
              <span key={p} style={{ fontSize: 34, marginRight: 22, padding: "8px 22px", border: "2px solid #fc7c0f", borderRadius: 999 }}>{p}</span>
            ))}
          </div>
        </div>
      </div>
    ),
    ogSize,
  );
}
