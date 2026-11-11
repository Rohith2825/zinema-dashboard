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
  ["attendance", "Attendance"],
  ["ai", "Connect your AI"],
  ["help", "Help"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card p-5 md:p-9">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-zinc-700">{children}</div>
    </section>
  );
}
const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-4">
    <span className="tile flex h-8 w-8 shrink-0 items-center justify-center !rounded-full text-xs font-semibold">{n}</span>
    <span className="min-w-0 pt-1 [overflow-wrap:anywhere]">{children}</span>
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
        <h1 className="mt-3 text-3xl font-semibold md:text-6xl">How Zinema OS works</h1>
        <p className="mt-4 max-w-2xl text-muted">Ten minutes, start to finish. If anything here doesn&apos;t match what you see, write to <Mail />.</p>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
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

            <Section id="attendance" title="Attendance">
              <p>If an owner has switched attendance on for you, <b>Attendance</b> appears as your daily check-in.</p>
              <ol className="space-y-4">
                <Step n={1}>Open <b>Attendance</b> at the office and press <b>Use my location</b>. You need to be within the office&apos;s range (usually 1 km).</Step>
                <Step n={2}>Take a selfie. It&apos;s stamped with the time and your location and saved privately — only you and the owners can see it.</Step>
                <Step n={3}>Check out the same way when you leave.</Step>
              </ol>
              <p className="well p-4 text-sm">Allow location and camera for this site when your browser asks. On a phone, turn on precise location for the best result.</p>
            </Section>

            <Section id="ai" title="Connect your AI">
              <p>Zinema OS is an MCP server, so your assistant can work the pipeline with you. We support <b>Claude</b> and <b>ChatGPT</b>. Server address:</p>
              <p className="well overflow-x-auto p-4 font-mono text-sm">{mcp}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="tile min-w-0 p-5">
                  <p className="font-semibold text-foreground">Claude</p>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                    <li>Open Claude (web, desktop or phone) → <b>Settings → Connectors</b>.</li>
                    <li>Choose <b>Add custom connector</b>, name it “Zinema OS” and paste the address.</li>
                    <li>Click <b>Connect</b>, sign in with your Zinema Google account and press <b>Allow access</b>.</li>
                    <li>In a chat, switch the Zinema OS connector on.</li>
                  </ol>
                </div>
                <div className="tile min-w-0 p-5">
                  <p className="font-semibold text-foreground">ChatGPT</p>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                    <li>Open ChatGPT → <b>Settings → Apps &amp; Connectors</b>.</li>
                    <li>Under <b>Advanced settings</b> turn on <b>Developer mode</b>, then choose <b>Create</b>.</li>
                    <li>Name it “Zinema OS”, paste the address, keep authentication on <b>OAuth</b> and create it.</li>
                    <li>Sign in with your Zinema Google account, press <b>Allow access</b>, then pick Zinema OS in a chat.</li>
                  </ol>
                </div>
              </div>
              <p>Either way the assistant acts as you: same pages, same role, logged as “via AI”. Try “what&apos;s in my queue?”, “show me TAM-0001” or “save this as captions.csv in the song&apos;s Drive folder”.</p>
              <p className="well p-4 text-sm">Menu names move around between app versions. If you can&apos;t find the screen, or the sign-in loops, write to <Mail /> and we&apos;ll set it up with you.</p>
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
