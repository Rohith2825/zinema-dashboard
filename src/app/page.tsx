import type { Metadata } from "next";
import Link from "next/link";
import { Eq, PublicFooter, PublicHeader } from "@/components/marketing";
import { STAGES } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: "Zinema OS — every song, from first lyric to live" },
  description: "The operating system behind Zinema Music: one pipeline for songs, approvals, formats, releases and Google Drive — with Claude and ChatGPT plugged straight in.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

const W = "mx-auto w-[min(1120px,calc(100%-2rem))]";
const Sq = () => <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 bg-brand-500" />;

/* ───────── Illustrations (pure markup, no images) ───────── */

function BoardArt() {
  const cols: [string, [string, string, number][]][] = [
    ["Lyrics", [["TAM-0008", "#fc7c0f", 40]]],
    ["Mix & Master", [["HIN-0007", "#e11d48", 70], ["SPI-0011", "#a855f7", 20]]],
    ["Video", [["TAM-0007", "#fc7c0f", 55]]],
    ["Live", [["SPI-0010", "#a855f7", 100], ["HIN-0006", "#e11d48", 100]]],
  ];
  return (
    <div className="card relative mx-auto max-w-4xl p-3 !shadow-raise-lg md:p-5" aria-hidden="true">
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <i className="h-2.5 w-2.5 rounded-full bg-brand-500" /><i className="h-2.5 w-2.5 rounded-full bg-black/10" /><i className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="ml-3 text-[11px] font-medium text-muted">Song board</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        {cols.map(([label, cards]) => (
          <div key={label} className="well min-h-32 p-2.5 md:min-h-44">
            <p className="eyebrow mb-2 px-1 !text-[9px]">{label}</p>
            <div className="space-y-2">
              {cards.map(([code, colour, pct]) => (
                <div key={code} className="tile !rounded-xl px-2.5 py-2">
                  <p className="flex items-center gap-1.5 font-mono text-[9px] text-muted"><i className="h-1.5 w-1.5 rounded-full" style={{ background: colour }} />{code}</p>
                  <div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-black/10" />
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Floating notes */}
      <div className="tile absolute -left-3 bottom-10 hidden items-center gap-3 px-4 py-3 md:flex lg:-left-10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">✓</span>
        <span className="text-xs"><b className="block">Master approved</b><span className="text-muted">by the checker · just now</span></span>
      </div>
      <div className="absolute -right-3 top-16 hidden items-center gap-3 rounded-2xl bg-[#0b0b0d] px-4 py-3 text-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] md:flex lg:-right-10">
        <span className="eq-loader" aria-hidden="true"><i /><i /><i /><i /></span>
        <span className="text-xs"><b className="block">SPI-0010 is live</b><span className="text-neutral-400">Spotify · YouTube · Instagram</span></span>
      </div>
    </div>
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
  const covers = ["#fc7c0f", "#e11d48", "#a855f7"];
  const formats = [["Vertical", "live"], ["Carousel", "live"], ["Lyric video", "in review"], ["Music video", "planned"]];
  return (
    <div className="well grid gap-4 p-5 sm:grid-cols-[auto_1fr] md:p-7" aria-hidden="true">
      <div className="flex gap-3 sm:flex-col">
        {covers.map((c, i) => (
          <div key={c} className="flex h-20 w-20 items-end gap-[3px] rounded-2xl p-2.5 shadow-raise-sm" style={{ background: `radial-gradient(circle at 75% 20%, ${c}66, transparent 60%), #0a0a0a` }}>
            {[40, 75, 55, 90, 35, 65, 50].map((h, j) => <i key={j} className="flex-1 rounded-t-sm" style={{ height: `${(h + i * 13) % 90 + 10}%`, background: c }} />)}
          </div>
        ))}
      </div>
      <div className="space-y-2.5">
        {formats.map(([name, state]) => (
          <div key={name} className="tile flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-medium">{name}</span>
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

function ChatArt() {
  return (
    <div className="rounded-[28px] bg-[#0b0b0d] p-5 text-[13px] leading-relaxed text-neutral-300 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)] md:p-7" aria-hidden="true">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-white">What&apos;s blocking TAM-0007 from distribution?</div>
      <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1 font-mono text-[11px] text-brand-400"><Sq />zinema-os · get_song</p>
      <div className="mt-3 w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-2.5">The master is approved. The artwork has been waiting for a checker since Tuesday — shall I assign it and nudge them?</div>
      <div className="ml-auto mt-4 w-fit rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-white">Yes, and save the captions to Drive.</div>
      <p className="mt-4 flex flex-wrap gap-2 font-mono text-[11px] text-brand-400">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1"><Sq />create_task</span>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1"><Sq />save_to_drive</span>
      </p>
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
          <Link href="/guide" className="btn-ghost !rounded-full !px-7 !py-3 !text-base">Read the guide</Link>
        </div>
        <p className="mt-5 text-xs text-muted">Tamil · Hindi · Marathi · Spiritual · Community</p>
        <div className="mt-14 md:mt-20"><BoardArt /></div>
      </section>

      {/* Numbers */}
      <section className={`${W} mt-16 md:mt-24`}>
        <dl className="card grid grid-cols-2 gap-y-8 px-6 py-8 text-center md:grid-cols-4 md:py-10">
          {[["8", "stages, one direction"], ["5", "pages, one team"], ["3 + 3", "carousels & verticals per song"], ["2", "AIs supported: Claude & ChatGPT"]].map(([n, l]) => (
            <div key={l}>
              <dt className="text-3xl font-semibold tracking-tight md:text-5xl">{n}</dt>
              <dd className="mx-auto mt-2 max-w-[11rem] text-xs text-muted md:text-sm">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Pipeline */}
      <section id="platform" className={`${W} mt-24 md:mt-36`}>
        <p className="eyebrow">The pipeline</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-5xl">Eight stages. One direction. No guessing.</h2>
        <div className="card mt-10 px-4 py-8 md:px-10 md:py-10">
          <div className="relative">
            <div className="well absolute left-0 right-0 top-[13px] hidden h-1.5 !rounded-full md:block" />
            <span className="mk-flow absolute top-[9px] hidden h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-brand-500 shadow-[0_0_14px_#fc7c0f] md:block" />
            <ol className="relative grid grid-cols-4 gap-y-6 md:grid-cols-8">
              {STAGES.map((st, i) => (
                <li key={st.key} className="flex flex-col items-center text-center">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${i === 7 ? "bg-brand-500 text-black shadow-[0_6px_14px_-4px_rgba(252,124,15,0.8)]" : "tile"}`}>{i + 1}</span>
                  <span className="mt-3 text-[11px] font-medium md:text-sm">{st.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
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
          <p className="mt-5 text-muted md:text-lg">
            Zinema OS speaks MCP. Connect your assistant and ask “what&apos;s waiting on me?”, “plan the verticals for TAM-0007” or “save this caption sheet to the song&apos;s folder”.
          </p>
          <ul className="mt-6 space-y-3 text-sm md:text-base">
            {["It signs in as you — same pages, same role", "Everything it does is logged as “via AI”", "What it makes is filed in Drive, next to the song"].map((x) => <li key={x} className="flex items-center gap-3"><Sq />{x}</li>)}
          </ul>
          <Link href="/guide#ai" className="btn-dark mt-8 !rounded-full !px-6 !py-2.5">How to connect</Link>
        </div>
        <ChatArt />
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
