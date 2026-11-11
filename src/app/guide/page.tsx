import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/marketing";
import { SITE_URL } from "@/lib/site";
import { ROLES, STAGES } from "@/lib/types";

export const metadata: Metadata = {
  title: "Guide",
  description: "How to get into Zinema OS, what each role does, how a song moves from lyrics to live, and how to connect your own AI.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/guide" },
};

const SECTIONS = [
  ["access", "Getting access"],
  ["roles", "Roles"],
  ["pipeline", "How a song moves"],
  ["formats", "Formats & publishing"],
  ["files", "Files & Google Drive"],
  ["ai", "Connect your AI"],
  ["drive", "Google Drive setup (admins)"],
  ["help", "Help"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card p-7 md:p-9">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-zinc-700">{children}</div>
    </section>
  );
}
const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-4">
    <span className="tile flex h-8 w-8 shrink-0 items-center justify-center !rounded-full text-xs font-semibold">{n}</span>
    <span className="pt-1">{children}</span>
  </li>
);
const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12px]">{children}</code>;
const Mail = () => <a href="mailto:info@zinema.music" className="font-medium text-brand-700 underline">info@zinema.music</a>;

export default function Guide() {
  const mcp = `${SITE_URL}/api/mcp`;
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <div className="mx-auto mt-14 w-[min(1120px,calc(100%-2rem))]">
        <p className="eyebrow">Guidebook</p>
        <h1 className="mt-3 text-4xl font-semibold md:text-6xl">How Zinema OS works</h1>
        <p className="mt-4 max-w-2xl text-muted">Ten minutes, start to finish. If anything here doesn&apos;t match what you see, write to <Mail />.</p>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="well hidden p-3 text-sm lg:sticky lg:top-24 lg:block" aria-label="Guide sections">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-xl px-3 py-2 text-zinc-600 hover:bg-surface hover:text-black">{label}</a>
            ))}
          </nav>

          <div className="space-y-8">
            <Section id="access" title="Getting access">
              <ol className="space-y-4">
                <Step n={1}>Go to <Link href="/login" className="font-medium text-brand-700 underline">the sign-in page</Link> and continue with your Google account. There are no passwords.</Step>
                <Step n={2}>The first time, you&apos;ll see “You&apos;re in — almost”. That&apos;s expected: you exist, but you aren&apos;t on a page yet.</Step>
                <Step n={3}>Tell your page admin (or write to <Mail />) which Google email you used. They give you a role on Tamil, Hindi, Marathi, Spiritual or Community.</Step>
                <Step n={4}>Refresh. The board, catalog and calendar are now yours.</Step>
              </ol>
              <p className="well p-4 text-sm">Signed in with the wrong Google account? Sign out from the bottom of the side rail and pick the right one.</p>
            </Section>

            <Section id="roles" title="Roles">
              <p>You get a role per page, and you can hold different roles on different pages.</p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <li key={r.key} className="tile p-4">
                    <p className="flex items-center gap-2 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0d0d10] text-sm text-white">{r.icon}</span>{r.label}</p>
                    <p className="mt-1.5 text-sm text-muted">{r.desc}</p>
                  </li>
                ))}
              </ul>
              <p>Royalty splits and contract terms are visible to rights owners only — not to admins, and not to AI connected by anyone else.</p>
            </Section>

            <Section id="pipeline" title="How a song moves">
              <div className="flex flex-wrap gap-2">
                {STAGES.map((st, i) => (
                  <span key={st.key} className="tile !rounded-full px-3 py-1.5 text-sm"><span className="mr-1.5 text-muted">{i + 1}</span>{st.label}</span>
                ))}
              </div>
              <ol className="space-y-4">
                <Step n={1}><b>A maker submits</b> a file for an item — upload it, or paste a Google Drive link.</Step>
                <Step n={2}><b>A checker reviews</b> it: approve, or request changes with a note. You can never review your own submission.</Step>
                <Step n={3}><b>An approver moves the song on</b> once everything the stage requires is approved. The button simply won&apos;t work before that.</Step>
              </ol>
              <p>Every song needs <b>3 carousels and 3 verticals</b> before promo is done. Songs are labelled <b>Zinema Original</b> (made and owned by Zinema) or <b>Community</b> (released with Zinema, owned by the artist).</p>
            </Section>

            <Section id="formats" title="Formats & publishing">
              <p>A song lives in many formats — vertical, carousel, lyric video, flagship music video, AI music video, visualizer, image-only video, audio. Add one at any time, even years after release.</p>
              <p>Each format has its own checklist, owner, planned date and files. When it goes out, tick where it was posted under <b>Published on</b> (Instagram, YouTube, Shorts, Spotify…) with the link. The first tick marks the format live and puts it on the calendar.</p>
            </Section>

            <Section id="files" title="Files & Google Drive">
              <p>Google Drive is the single home for files. Zinema OS keeps it tidy: <Code>Zinema OS / Page / CODE · Title / Stage</Code>.</p>
              <p>Use <b>Upload to Drive &amp; submit</b> on any item: the file goes straight from your browser to the right folder (large WAV and video files are fine) and is sent for checking in one step. You can still paste a Drive link if the file is already there.</p>
            </Section>

            <Section id="ai" title="Connect your AI">
              <p>Zinema OS is an MCP server, so your assistant can work the pipeline with you. Server address:</p>
              <p className="well overflow-x-auto p-4 font-mono text-sm">{mcp}</p>
              <ul className="space-y-3">
                <li><b>Claude (web, desktop, mobile):</b> Settings → Connectors → Add custom connector → paste the address → sign in with your Zinema Google account.</li>
                <li><b>Claude Code:</b> <Code>claude mcp add --transport http zinema-os {mcp}</Code></li>
                <li><b>Anything else:</b> add a remote HTTP MCP server. If it can&apos;t open a sign-in window, create a personal token under <b>Connect AI</b> in the dashboard and send it as <Code>Authorization: Bearer zos_…</Code></li>
              </ul>
              <p>Your AI acts as you: same pages, same role, logged as “via AI”. Try “what&apos;s in my queue?”, “show me TAM-0001” or “save this as captions.csv in the song&apos;s Drive folder”.</p>
            </Section>

            <Section id="drive" title="Google Drive setup (admins)">
              <p>One-time setup in Google Cloud and Vercel. Pick <b>one</b> of the two routes.</p>
              <p className="font-semibold text-foreground">Route A — service account + shared drive (best if you have Google Workspace)</p>
              <ol className="space-y-3">
                <Step n={1}>Google Cloud → enable the <b>Google Drive API</b> → IAM → Service accounts → create one → Keys → add a JSON key.</Step>
                <Step n={2}>In Google Drive create a <b>shared drive</b> (e.g. “Zinema OS”), add the service account&apos;s email as <b>Content manager</b>, and add the team.</Step>
                <Step n={3}>In Vercel add <Code>GOOGLE_SERVICE_ACCOUNT_KEY</Code> (the whole JSON) and <Code>GOOGLE_DRIVE_ROOT_ID</Code> (the id from the shared drive&apos;s URL). Redeploy.</Step>
              </ol>
              <p className="well p-4 text-sm">A service account has no storage of its own, so it can&apos;t upload into a personal “My Drive” folder — it must be a shared drive.</p>
              <p className="font-semibold text-foreground">Route B — a Google account (works with plain Gmail)</p>
              <ol className="space-y-3">
                <Step n={1}>Enable the Drive API, then create an OAuth client (type: Web) with redirect URI <Code>https://developers.google.com/oauthplayground</Code>.</Step>
                <Step n={2}>In the OAuth Playground (gear → use your own credentials) authorise the scope <Code>https://www.googleapis.com/auth/drive</Code> as the account that should own the files, and exchange for a <b>refresh token</b>.</Step>
                <Step n={3}>In Vercel add <Code>GOOGLE_OAUTH_CLIENT_ID</Code>, <Code>GOOGLE_OAUTH_CLIENT_SECRET</Code>, <Code>GOOGLE_OAUTH_REFRESH_TOKEN</Code> and <Code>GOOGLE_DRIVE_ROOT_ID</Code> (a folder in that account, shared with the team). Redeploy.</Step>
              </ol>
              <p>Then open <b>Connect AI</b> in the dashboard: the Google Drive card should say <b>Connected</b>.</p>
            </Section>

            <Section id="help" title="Help">
              <p>Can&apos;t get in, missing a page, or something looks wrong? Write to <Mail /> with the Google email you sign in with and, if it&apos;s about a song, its code (like TAM-0007).</p>
            </Section>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
