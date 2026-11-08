import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogAlt = "Zinema Music — Tamil, Hindi, Marathi, Spiritual and Indie";

const PAGES = ["Tamil", "Hindi", "Marathi", "Spiritual", "Indie"];

/** Shared 1200×630 card for Open Graph and Twitter, built from the real logo lockup. */
export async function ogCard() {
  const logo = await readFile(join(process.cwd(), "public/brand/zinema-logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#000", color: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={820} height={300} />
        <div style={{ display: "flex", marginTop: 56 }}>
          {PAGES.map((p) => (
            <span key={p} style={{ fontSize: 32, margin: "0 11px", padding: "8px 24px", border: "2px solid #fc7c0f", borderRadius: 999 }}>{p}</span>
          ))}
        </div>
      </div>
    ),
    ogSize,
  );
}
