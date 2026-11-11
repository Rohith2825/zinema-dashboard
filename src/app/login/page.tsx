import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { GoogleButton } from "./google-button";
import "./login.css";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Zinema OS — every Zinema Music song from first lyric to live.",
  robots: { index: true, follow: false },
  alternates: { canonical: "/login" },
};

const PAGES = ["Tamil", "Hindi", "Marathi", "Spiritual", "Community"];

// Equalizer bars: deterministic "random" timings so server and client render the same markup.
const BARS = Array.from({ length: 64 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const centre = 1 - Math.abs(i - 31.5) / 40; // taller in the middle
  return {
    "--d": `${(0.35 + r(1) * 0.6).toFixed(2)}s`,
    "--o": `${(-r(2) * 1.2).toFixed(2)}s`,
    "--lo": (0.05 + r(3) * 0.15).toFixed(2),
    "--hi": (0.3 + centre * 0.55 + r(4) * 0.15).toFixed(2),
  } as React.CSSProperties;
});

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="zl">
      <div className="zl-glow" aria-hidden="true" />
      <div className="zl-rings" aria-hidden="true">
        {[0, 1, 2, 3].map((n) => <i key={n} style={{ "--n": n } as React.CSSProperties} />)}
      </div>
      <div className="zl-eq" aria-hidden="true">
        {BARS.map((style, i) => <i key={i} style={style} />)}
      </div>

      <div className="zl-stack">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="zl-logo" src="/brand/zinema-logo-ink.png" alt="Zinema Music — It Just Hits" width={1000} height={366} />
        <h1 className="zl-kicker">Zinema <b>OS</b></h1>
        <p className="zl-sub">Sign in with your Zinema Google account.</p>
        <Suspense fallback={<GoogleButton className="zl-google" />}>
          <LoginForm searchParams={searchParams} />
        </Suspense>
        <p className="zl-pages">{PAGES.map((p) => <span key={p}>{p}</span>)}</p>
        <p className="zl-links"><Link href="/">About Zinema OS</Link><Link href="/guide">Guide</Link><a href="mailto:info@zinema.music">Help</a></p>
      </div>
    </main>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  return (
    <>
      {error && <p className="zl-error">Sign-in failed. Please try again.</p>}
      <GoogleButton className="zl-google" next={typeof next === "string" ? next : undefined} />
    </>
  );
}
