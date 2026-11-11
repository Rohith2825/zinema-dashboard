import type { Metadata } from "next";
import Link from "next/link";
import { Eq, PublicFooter, PublicHeader } from "@/components/marketing";
import { STAGES } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: "Zinema OS — every song, from first lyric to live" },
  description: "The operating system behind Zinema Music: one pipeline for songs, approvals, formats, releases and Google Drive — and an MCP server so your own AI can run it with you.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

const FEATURES = [
  ["One pipeline", "Eight stages from lyrics to live. A song can't move on until the right person has approved the right files."],
  ["Maker · Checker · Approver", "Clear roles on every page. Nobody checks their own work, and every decision is on record."],
  ["Formats with a life after release", "Verticals, carousels, lyric videos, music videos, AI videos — each with its own checklist and where it's been posted."],
  ["Catalog", "Every release in one place: cover, artists, ISRC, release date, Zinema Original or Community."],
  ["Calendars that agree", "Song releases and content drops on one calendar, in India time."],
  ["Google Drive, organised for you", "Each song gets its folder. Upload from the dashboard and the file lands in the right place."],
];

const PLANS = [
  { name: "Zinema team", price: "Included", note: "for everyone on a Zinema page", points: ["Full pipeline, catalog and calendars", "Google Drive filing", "Connect your own AI"], cta: "Sign in", href: "/login", primary: true },
  { name: "Community artists", price: "By invitation", note: "for artists releasing with Zinema", points: ["Your songs on the Community page", "See status, files and release dates", "Splits agreed per song, in writing"], cta: "Ask to join", href: "mailto:info@zinema.music?subject=Community%20access%20to%20Zinema%20OS" },
  { name: "Partners & labels", price: "Let's talk", note: "distribution, sync and collaborations", points: ["Guest access to specific songs", "Shared release calendar", "A named contact at Zinema"], cta: "Write to us", href: "mailto:info@zinema.music?subject=Partnering%20with%20Zinema%20Music" },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <PublicHeader />

      {/* Hero */}
      <section className="mx-auto mt-10 w-[min(1120px,calc(100%-2rem))]">
        <div className="relative overflow-hidden rounded-[36px] bg-[#0b0b0d] px-6 pb-0 pt-16 text-center text-white shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)] md:px-16 md:pt-24">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 50% 35%, rgba(252,124,15,0.28), transparent 55%)" }} />
          <div className="relative">
            <p className="eyebrow !text-brand-400">The Zinema Music operating system</p>
            <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              Every song, from first lyric to <span className="text-brand-500">live.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-neutral-400 md:text-lg">
              One calm place for the whole team — writing, mixing, approvals, releases and every post after — with your own AI plugged straight in.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="btn !rounded-full !px-6 !py-3">Sign in with Google</Link>
              <Link href="/guide" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">Read the guide</Link>
            </div>
            <p className="mt-5 text-xs text-neutral-500">Tamil · Hindi · Marathi · Spiritual · Community</p>
          </div>
          <Eq bars={64} className="relative mt-14 h-28 opacity-80 md:h-40" />
        </div>
      </section>

      {/* Pipeline */}
      <section id="platform" className="mx-auto mt-28 w-[min(1120px,calc(100%-2rem))]">
        <p className="eyebrow">The pipeline</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-5xl">Eight stages. One direction. No guessing.</h2>
        <div className="card mt-10 px-6 py-10 md:px-10">
          <div className="relative">
            <div className="well absolute left-0 right-0 top-[13px] h-1.5 !rounded-full" />
            <span className="mk-flow absolute top-[9px] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-brand-500 shadow-[0_0_14px_#fc7c0f]" />
            <ol className="relative grid grid-cols-4 gap-y-8 md:grid-cols-8">
              {STAGES.map((st, i) => (
                <li key={st.key} className="flex flex-col items-center text-center">
                  <span className="tile flex h-8 w-8 items-center justify-center !rounded-full text-[11px] font-semibold">{i + 1}</span>
                  <span className="mt-3 text-xs font-medium md:text-sm">{st.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="card p-7">
              <span className="block h-2.5 w-2.5 bg-brand-500" />
              <h3 className="mt-5 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bring your own AI */}
      <section id="ai" className="mx-auto mt-28 w-[min(1120px,calc(100%-2rem))]">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow">Bring your own AI</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-5xl">Zinema OS speaks MCP.</h2>
            <p className="mt-5 text-muted">
              Connect Claude or ChatGPT and ask it things like “what&apos;s waiting on me?”, “plan the verticals for TAM-0007” or “save this caption sheet to the song&apos;s Drive folder”.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {["It signs in as you, so it can only do what your role allows", "Everything it does is logged as “via AI”", "What it creates is filed in Google Drive, next to the song"].map((x) => (
                <li key={x} className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 bg-brand-500" />{x}</li>
              ))}
            </ul>
            <Link href="/guide#ai" className="btn-dark mt-8 !rounded-full !px-5">How to connect</Link>
          </div>
          <div className="rounded-[28px] bg-[#0b0b0d] p-6 font-mono text-[13px] leading-relaxed text-neutral-300 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">
            <p className="text-neutral-500">you</p>
            <p>What&apos;s blocking TAM-0007 from going to distribution?</p>
            <p className="mt-5 text-brand-400">zinema-os · get_song</p>
            <p className="mt-5 text-neutral-500">assistant</p>
            <p>The master WAV is approved. The artwork is waiting for a checker since Tuesday — want me to assign it and nudge them?</p>
            <p className="mt-5 text-brand-400">zinema-os · create_task</p>
            <span className="eq-loader mt-5" aria-hidden="true"><i /><i /><i /><i /></span>
          </div>
        </div>
      </section>

      {/* Access & pricing */}
      <section id="access" className="mx-auto mt-28 w-[min(1120px,calc(100%-2rem))]">
        <p className="eyebrow">Access &amp; pricing</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-5xl">Built for the team. Open by invitation.</h2>
        <p className="mt-4 max-w-2xl text-muted">Zinema OS isn&apos;t sold as software. It&apos;s how Zinema Music works — and how the people we work with stay in the loop.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`flex flex-col p-8 ${p.primary ? "rounded-[22px] bg-[#0b0b0d] text-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]" : "card"}`}>
              <p className={`eyebrow ${p.primary ? "!text-brand-400" : ""}`}>{p.name}</p>
              <p className="mt-4 text-3xl font-semibold">{p.price}</p>
              <p className={`mt-1 text-sm ${p.primary ? "text-neutral-400" : "text-muted"}`}>{p.note}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {p.points.map((x) => <li key={x} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-brand-500" />{x}</li>)}
              </ul>
              <a href={p.href} className={`mt-8 ${p.primary ? "btn" : "btn-ghost"} !rounded-full`}>{p.cta}</a>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          Can&apos;t sign in, or not sure which applies to you? Write to <a href="mailto:info@zinema.music" className="font-medium text-brand-700 underline">info@zinema.music</a> and we&apos;ll sort it out.
        </p>
      </section>

      <PublicFooter />
    </div>
  );
}
