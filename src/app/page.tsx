import type { Metadata } from "next";
import Link from "next/link";
import { Eq, PublicFooter, PublicHeader } from "@/components/marketing";
import { AiTabs } from "@/components/landing/ai-tabs";
import { LiveBoard } from "@/components/landing/live-board";
import { BrandIcon, type Brand } from "@/components/landing/logos";
import { SONGS } from "@/components/landing/songs";

export const metadata: Metadata = {
  title: { absolute: "Zinema OS — every song, from first lyric to live" },
  description: "The operating system behind Zinema Music: one pipeline for songs, approvals, formats, releases and Google Drive — with Claude and ChatGPT plugged straight in.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

const W = "mx-auto w-[min(1120px,calc(100%-2rem))]";
const Sq = () => <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 bg-brand-500" />;

/* ───────── Illustrations (pure markup, no images) ───────── */

const O = "#fc7c0f";
const K = "#0d0d10";
/** Small abstract drawing per stage. */
const STAGE_ART: Record<string, React.ReactNode> = {
  lyrics: <>{[10, 22, 34, 46].map((y, i) => <rect key={y} x="14" y={y} width={[70, 92, 56, 80][i]} height="5" rx="2.5" fill={i === 1 ? O : K} opacity={i === 1 ? 1 : 0.18} />)}</>,
  music: <>{[18, 34, 52, 30, 60, 44, 26, 48, 36, 20, 42, 28].map((h, i) => <rect key={i} x={12 + i * 8.5} y={32 - h / 2} width="5" height={h} rx="2.5" fill={i === 4 || i === 5 ? O : K} opacity={i === 4 || i === 5 ? 1 : 0.2} />)}</>,
  master_qc: <><path d="M20 52a40 40 0 0180 0" fill="none" stroke={K} strokeOpacity=".15" strokeWidth="8" strokeLinecap="round" /><path d="M20 52a40 40 0 0162-33" fill="none" stroke={O} strokeWidth="8" strokeLinecap="round" /><path d="M60 52l20-26" stroke={K} strokeWidth="3" strokeLinecap="round" /><circle cx="60" cy="52" r="5" fill={K} /></>,
  distribution: <>{[3, 1.5, 4, 2, 1.5, 5, 2, 3, 1.5, 4, 2, 3, 1.5, 5].reduce<{ x: number; els: React.ReactNode[] }>((a, w, i) => ({ x: a.x + w + 3, els: [...a.els, <rect key={i} x={a.x} y="12" width={w} height="34" fill={i === 5 ? O : K} opacity={i === 5 ? 1 : 0.75} />] }), { x: 22, els: [] }).els}<rect x="22" y="50" width="76" height="4" rx="2" fill={K} opacity=".15" /></>,
  video: <><rect x="20" y="10" width="80" height="44" rx="8" fill={K} /><path d="M54 22l16 10-16 10z" fill={O} /><rect x="26" y="46" width="68" height="3" rx="1.5" fill="#fff" opacity=".25" /><rect x="26" y="46" width="30" height="3" rx="1.5" fill={O} /></>,
  promo: <>{[0, 1, 2].map((i) => <rect key={i} x={14 + i * 17} y="14" width="13" height="36" rx="3" fill={O} opacity={1 - i * 0.25} />)}{[0, 1, 2].map((i) => <rect key={i} x={70 + i * 13} y={20 + i * 3} width="22" height="22" rx="4" fill={K} opacity={0.85 - i * 0.25} />)}</>,
  posting: <><path d="M30 32h28M58 32l26-16M58 32l26 16" stroke={K} strokeOpacity=".25" strokeWidth="3" /><circle cx="30" cy="32" r="9" fill={K} /><circle cx="58" cy="32" r="6" fill={O} /><circle cx="88" cy="14" r="7" fill={K} opacity=".8" /><circle cx="88" cy="50" r="7" fill={K} opacity=".8" /></>,
  live: <><circle cx="60" cy="32" r="26" fill="none" stroke={O} strokeOpacity=".25" strokeWidth="3" /><circle cx="60" cy="32" r="17" fill="none" stroke={O} strokeOpacity=".55" strokeWidth="3" /><circle cx="60" cy="32" r="8" fill={O} /></>,
};

const PIPELINE: { key: string; label: string; needs: string[]; check: string }[] = [
  { key: "lyrics", label: "Lyrics", needs: ["Final lyrics", "Sound brief"], check: "Hook, meaning and language reviewed" },
  { key: "music", label: "Music", needs: ["Rough mix", "Song metadata"], check: "Arrangement and credits confirmed" },
  { key: "master_qc", label: "Mix & Master", needs: ["Master WAV", "Artwork", "Stems (optional)"], check: "Loudness, true peak and artwork spec audited" },
  { key: "distribution", label: "Distribution", needs: ["ISRC and UPC", "Catalog number", "Release date"], check: "Upload to the distributor recorded with proof" },
  { key: "video", label: "Video", needs: ["Lyric video, visualizer, music video or AI video"], check: "At least one video approved" },
  { key: "promo", label: "Promo", needs: ["3 carousels", "3 verticals"], check: "All six approved, each with its checklist" },
  { key: "posting", label: "Posting", needs: ["Post links per platform", "Cross-post sign-off"], check: "Every format marked published" },
  { key: "live", label: "Live", needs: ["On Spotify and stores", "New formats any time after"], check: "The song keeps earning attention" },
];

function PipelineArt() {
  return (
    <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {PIPELINE.map((st, i) => (
        <li key={st.key} className="card relative flex flex-col p-5">
          <div className="flex items-center justify-between">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i === 7 ? "bg-brand-500 text-black" : "bg-[#0d0d10] text-white"}`}>{i + 1}</span>
            {i < 7 && (
              <svg width="44" height="10" viewBox="0 0 44 10" aria-hidden="true" className="text-brand-500">
                <path className="pl-dash" d="M0 5h36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M36 1l6 4-6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
          </div>
          <div className="well my-4 flex items-center justify-center !rounded-2xl py-3">
            <svg viewBox="0 0 120 64" className="h-16 w-full max-w-[150px]" aria-hidden="true">{STAGE_ART[st.key]}</svg>
          </div>
          <h3 className="text-lg font-semibold">{st.label}</h3>
          <ul className="mt-2 flex-1 space-y-1 text-sm text-zinc-700">
            {st.needs.map((n) => <li key={n} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-brand-500" />{n}</li>)}
          </ul>
          <p className="mt-4 flex gap-2 border-t border-black/[0.06] pt-3 text-xs text-muted">
            <span className="font-semibold text-emerald-700">✓</span>{st.check}
          </p>
        </li>
      ))}
    </ol>
  );
}

function FlowArt() {
  const steps = [["♪", "Maker", "submits the file"], ["✓", "Checker", "approves or asks for changes"], ["→", "Approver", "moves the song on"]];
  return (
    <div className="well space-y-3 p-5 md:p-7" aria-hidden="true">
      {steps.map(([icon, who, what], i) => (
        <div key={who} className="tile flex items-center gap-4 p-4" style={{ marginLeft: `${i * 8}%` }}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${i === 2 ? "bg-brand-500 text-black" : "bg-[#0d0d10] text-white"}`}>{icon}</span>
          <span className="text-sm"><b className="block">{who}</b><span className="text-muted">{what}</span></span>
        </div>
      ))}
    </div>
  );
}

function FormatsArt() {
  const picks = SONGS.slice(0, 3);
  const formats: [string, string, Brand | null][] = [["Audio", "live", "spotify"], ["Vertical 1", "live", "instagram"], ["Lyric video", "in review", "youtube"], ["Flagship music video", "planned", null]];
  return (
    <div className="well p-5 md:p-7">
      <div className="flex items-end justify-center">
        {picks.map((s, i) => (
          <a key={s.code} href={s.url} target="_blank" rel="noreferrer" title={`${s.title} on Spotify`} aria-label={`${s.title} on Spotify`} className={`block overflow-hidden rounded-2xl shadow-raise transition hover:-translate-y-1 ${i === 1 ? "z-10 w-36 md:w-44" : "w-28 opacity-90 md:w-32"} ${i === 0 ? "-mr-5 -rotate-6" : i === 2 ? "-ml-5 rotate-6" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.cover} alt="" loading="lazy" className="aspect-square w-full bg-[#0d0d10] object-cover" />
          </a>
        ))}
      </div>
      <p className="mt-4 text-center text-sm font-semibold">{picks[1].title} <span className="ml-1 font-mono text-xs font-normal text-muted">{picks[1].code}</span></p>
      <div className="mt-4 space-y-2.5" aria-hidden="true">
        {formats.map(([name, state, brand]) => (
          <div key={name} className="tile flex items-center gap-3 px-4 py-3 text-sm">
            <span className="flex-1 font-medium">{name}</span>
            {brand && <BrandIcon name={brand} size={16} />}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${state === "live" ? "bg-brand-500 text-black" : state === "planned" ? "bg-black/[0.06] text-zinc-600" : "bg-sky-500/15 text-sky-800"}`}>{state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriveArt() {
  const rows: [number, string, boolean?][] = [[0, "Zinema OS"], [1, "Tamil"], [2, "TAM-0007 · Ganesha", true], [3, "Mix & Master"], [3, "Promo"], [3, "AI outputs"]];
  return (
    <div className="well space-y-2 p-5 md:p-7" aria-hidden="true">
      {rows.map(([depth, name, hot]) => (
        <div key={name} className={`tile flex items-center gap-3 px-4 py-2.5 text-sm ${hot ? "ring-2 ring-brand-500/50" : ""}`} style={{ marginLeft: depth * 22 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={hot ? "#fc7c0f" : "#0d0d10"} aria-hidden="true"><path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
          <span className={hot ? "font-semibold" : ""}>{name}</span>
        </div>
      ))}
    </div>
  );
}

const ROWS = [
  {
    eyebrow: "Approvals",
    title: "Nothing ships unchecked.",
    body: "Every file goes maker → checker → approver. Nobody reviews their own work, a stage can't close until its files are approved, and every decision is on record.",
    points: ["Clear roles on every page", "Stage gates the system enforces", "A full activity trail"],
    art: <FlowArt />,
  },
  {
    eyebrow: "Formats & catalog",
    title: "One song, many lives.",
    body: "Verticals, carousels, lyric videos, music videos, AI videos — each with its own checklist, owner and the places it's been posted. The catalog keeps every release in view.",
    points: ["3 carousels + 3 verticals on every song", "Published-on tracking per platform", "Covers and release dates synced from Spotify"],
    art: <FormatsArt />,
  },
  {
    eyebrow: "Files",
    title: "Google Drive, organised for you.",
    body: "Each song gets its own folder. Upload from the dashboard — even large masters and videos — and the file lands in the right place, already sent for checking.",
    points: ["Page / Song / Stage folders, made automatically", "Straight from your browser to Drive", "One home for every file"],
    art: <DriveArt />,
  },
];

const PLANS = [
  { name: "Zinema team", price: "Included", note: "for everyone on a Zinema page", points: ["Full pipeline, catalog and calendars", "Google Drive filing", "Connect Claude or ChatGPT"], cta: "Sign in", href: "/login", primary: true },
  { name: "Community artists", price: "By invitation", note: "for artists releasing with Zinema", points: ["Your songs on the Community page", "See status, files and release dates", "Splits agreed per song, in writing"], cta: "Ask to join", href: "mailto:info@zinema.music?subject=Community%20access%20to%20Zinema%20OS" },
  { name: "Partners & labels", price: "Let's talk", note: "distribution, sync and collaborations", points: ["Guest access to specific songs", "Shared release calendar", "A named contact at Zinema"], cta: "Write to us", href: "mailto:info@zinema.music?subject=Partnering%20with%20Zinema%20Music" },
];

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <PublicHeader />

      {/* Hero */}
      <section className={`${W} relative pt-16 text-center md:pt-24`}>
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[min(900px,100vw)] -translate-x-1/2" style={{ background: "radial-gradient(closest-side, rgba(252,124,15,0.18), transparent)" }} />
        <p className="tile mx-auto inline-flex items-center gap-2 !rounded-full px-4 py-1.5 text-xs font-medium"><Sq />The Zinema Music operating system</p>
        <h1 className="mx-auto mt-7 max-w-4xl text-[2.6rem] font-semibold leading-[1.03] tracking-tight md:text-7xl">
          Every song, from first lyric to <span className="text-brand-500">live.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted md:text-lg">
          One calm place for the whole team — writing, mixing, approvals, releases and every post after — with your AI working alongside you.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="btn !rounded-full !px-7 !py-3 !text-base">Sign in with Google</Link>
          <a href="#platform" className="btn-ghost !rounded-full !px-7 !py-3 !text-base">See how it works</a>
        </div>
        <p className="mt-5 text-xs text-muted">Tamil · Hindi · Marathi · Spiritual · Community</p>
        <div className="mt-14 md:mt-20"><LiveBoard /></div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-muted">
          <span className="eyebrow">Works with</span>
          {(["claude", "chatgpt", "gemini", "drive", "spotify"] as Brand[]).map((b) => (
            <span key={b} className="flex items-center gap-2 font-medium text-zinc-700">
              <BrandIcon name={b} size={20} />
              {{ claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", drive: "Google Drive", spotify: "Spotify" }[b as "claude"]}
              {b === "gemini" && <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-normal text-muted">soon</span>}
            </span>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section id="platform" className={`${W} mt-20 md:mt-32`}>
        <p className="eyebrow">The pipeline</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-5xl">Eight stages. One direction. No guessing.</h2>
        <p className="mt-4 max-w-2xl text-muted md:text-lg">Each stage has things that must exist and a check that must pass. Nothing is skipped: the song only moves when an approver signs off.</p>
        <PipelineArt />
      </section>

      {/* Feature rows */}
      {ROWS.map((r, i) => (
        <section key={r.title} className={`${W} mt-24 grid items-center gap-10 md:mt-32 md:grid-cols-2 md:gap-16`}>
          <div className={i % 2 ? "md:order-2" : ""}>
            <p className="eyebrow">{r.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-[2.75rem] md:leading-[1.08]">{r.title}</h2>
            <p className="mt-5 text-muted md:text-lg">{r.body}</p>
            <ul className="mt-6 space-y-3 text-sm md:text-base">
              {r.points.map((x) => <li key={x} className="flex items-center gap-3"><Sq />{x}</li>)}
            </ul>
          </div>
          <div>{r.art}</div>
        </section>
      ))}

      {/* AI */}
      <section id="ai" className={`${W} mt-24 grid items-center gap-10 md:mt-32 md:grid-cols-2 md:gap-16`}>
        <div className="md:order-2">
          <p className="eyebrow">Bring your own AI</p>
          <h2 className="mt-3 text-3xl font-semibold md:text-[2.75rem] md:leading-[1.08]">Claude and ChatGPT, on the team.</h2>
          <div className="mt-5 flex gap-3">{(["claude", "chatgpt", "gemini"] as Brand[]).map((b) => <span key={b} className="tile flex h-12 w-12 items-center justify-center !rounded-2xl"><BrandIcon name={b} size={24} /></span>)}</div>
          <p className="mt-5 text-muted md:text-lg">
            Zinema OS speaks MCP. Connect your assistant and ask “what&apos;s waiting on me?”, “plan the verticals for TAM-0007” or “save this caption sheet to the song&apos;s folder”.
          </p>
          <ul className="mt-6 space-y-3 text-sm md:text-base">
            {["It signs in as you — same pages, same role", "Everything it does is logged as “via AI”", "What it makes is filed in Drive, next to the song"].map((x) => <li key={x} className="flex items-center gap-3"><Sq />{x}</li>)}
          </ul>
          <Link href="/login?next=%2Fhelp" className="btn-dark mt-8 !rounded-full !px-6 !py-2.5">Sign in to connect yours</Link>
        </div>
        <AiTabs />
      </section>

      {/* Everyday */}
      <section className={`${W} mt-24 md:mt-32`}>
        <p className="eyebrow">And the everyday things</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-5xl">Built around how the team actually works.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["M5 6h14v14H5zM5 10h14M9 3v4M15 3v4", "Calendars that agree", "Song releases and content drops on one calendar, in India time."],
            ["M4 7l2 2 3-4M4 16l2 2 3-4M13 7h7M13 17h7", "Tasks and @mentions", "Assign, tag and follow up without leaving the song."],
            ["M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z", "Attendance", "Check in from the office with your location and a selfie."],
            ["M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z", "Private where it matters", "Royalty splits and contracts are visible to rights owners only."],
          ].map(([d, t, b]) => (
            <div key={t} className="card p-6">
              <span className="tile flex h-11 w-11 items-center justify-center !rounded-2xl text-brand-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
              </span>
              <h3 className="mt-5 font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Access & pricing */}
      <section id="access" className={`${W} mt-24 md:mt-36`}>
        <p className="eyebrow">Access &amp; pricing</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-5xl">Built for the team. Open by invitation.</h2>
        <p className="mt-4 max-w-2xl text-muted md:text-lg">Zinema OS isn&apos;t sold as software. It&apos;s how Zinema Music works — and how the people we work with stay in the loop.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`flex flex-col p-7 md:p-8 ${p.primary ? "rounded-[22px] bg-[#0b0b0d] text-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]" : "card"}`}>
              <p className={`eyebrow ${p.primary ? "!text-brand-400" : ""}`}>{p.name}</p>
              <p className="mt-4 text-3xl font-semibold">{p.price}</p>
              <p className={`mt-1 text-sm ${p.primary ? "text-neutral-400" : "text-muted"}`}>{p.note}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {p.points.map((x) => <li key={x} className="flex items-center gap-3"><Sq />{x}</li>)}
              </ul>
              <a href={p.href} className={`mt-8 ${p.primary ? "btn" : "btn-ghost"} !rounded-full`}>{p.cta}</a>
            </div>
          ))}
        </div>
      </section>

      {/* Closing band */}
      <section className={`${W} mt-24 md:mt-36`}>
        <div className="relative overflow-hidden rounded-[36px] bg-[#0b0b0d] px-6 pt-14 text-center text-white shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)] md:pt-20">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 50% 30%, rgba(252,124,15,0.3), transparent 55%)" }} />
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/zinema-logo.png" alt="Zinema Music — It Just Hits" width={260} height={95} className="mx-auto h-auto w-52 md:w-64" />
            <h2 className="mx-auto mt-8 max-w-2xl text-3xl font-semibold md:text-5xl">You&apos;re part of something that just hits.</h2>
            <p className="mx-auto mt-4 max-w-md text-neutral-400">Sign in with your Google account. Not on a page yet? Write to <a href="mailto:info@zinema.music" className="text-brand-400 underline">info@zinema.music</a>.</p>
            <Link href="/login" className="btn mt-8 !rounded-full !px-7 !py-3 !text-base">Open Zinema OS</Link>
          </div>
          <Eq bars={56} className="relative mt-12 h-24 opacity-80 md:h-32" />
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
