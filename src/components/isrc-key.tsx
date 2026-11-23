/**
 * Explains Zinema's ISRC numbering wherever a number is shown, so nobody has to remember the rule.
 * Song:  IN Z26 YY P SSSS      Video: IN Z27 YY P SSS T   (see migration 0030)
 */

const PAGES: Record<string, string> = { "1": "Tamil", "2": "Hindi", "3": "Marathi", "4": "Spiritual" };
const VIDEO_KINDS: Record<string, string> = { "1": "lyric video", "2": "main music video", "3": "visualizer", "4": "AI music video" };
const TONES = ["bg-zinc-200/70", "bg-brand-500/20", "bg-sky-500/15", "bg-emerald-500/15", "bg-violet-500/15", "bg-amber-500/25"];

type Part = { text: string; label: string; means: string };

/** Splits one of our own numbers into its parts. Returns null for any other ISRC (for example an older release). */
export function readIsrc(code: string): { video: boolean; parts: Part[] } | null {
  const m = /^IN(Z26|Z27)(\d{2})(\d)(\d{4})$/.exec(code);
  if (!m) return null;
  const [, owner, yy, p, rest] = m;
  const video = owner === "Z27";
  const parts: Part[] = [
    { text: "IN", label: "Country", means: "India" },
    { text: owner, label: "Label", means: video ? "Zinema Music, videos" : "Zinema Music, songs" },
    { text: yy, label: "Year", means: `20${yy}` },
    { text: p, label: "Page", means: PAGES[p] ?? "page " + p },
  ];
  if (video) {
    const t = rest[3];
    parts.push({ text: rest.slice(0, 3), label: "Song", means: `song no. ${Number(rest.slice(0, 3))}` }, { text: t, label: "Video", means: VIDEO_KINDS[t] ?? "extra video" });
  } else parts.push({ text: rest, label: "Song", means: `song no. ${Number(rest)}` });
  return { video, parts };
}

/** One number, cut into coloured parts with what each part means underneath. */
export function IsrcBreakdown({ code, title }: { code: string; title?: string }) {
  const read = readIsrc(code);
  if (!read) return <p className="font-mono text-sm">{code}</p>;
  return (
    <div className="min-w-0">
      {title && <p className="mb-1 text-xs font-medium">{title}</p>}
      <div className="flex flex-wrap gap-1">
        {read.parts.map((p, i) => (
          <div key={i} className="text-center">
            <p className={`rounded-lg px-2 py-1 font-mono text-sm font-semibold tracking-wider ${TONES[i]}`}>{p.text}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">{p.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-zinc-600">{read.parts.map((p) => p.means).join(" · ")}</p>
    </div>
  );
}

/** The rule itself, in words. */
export function IsrcRules() {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <div className="tile p-3"><IsrcBreakdown code="INZ262610002" title="A song (audio)" /></div>
        <div className="tile p-3"><IsrcBreakdown code="INZ272610021" title="Its lyric video" /></div>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-[13px] text-zinc-700">
        <li><b>Label</b>: <span className="font-mono">Z26</span> is always a song, <span className="font-mono">Z27</span> is always a video.</li>
        <li><b>Page</b>: 1 Tamil, 2 Hindi, 3 Marathi, 4 Spiritual.</li>
        <li><b>Song</b>: counts up on each page and starts again at 1 every year. A song has four digits (0002); its videos repeat the last three (002).</li>
        <li><b>Video</b> (last digit): 1 lyric video, 2 main music video, 3 visualizer, 4 AI music video, 5 to 9 for one more video of a kind the song already has.</li>
        <li>So a video with the same year, page and song number as a song <b>belongs to that song</b>.</li>
        <li>Zinema OS gives the numbers by itself: the song&apos;s when the song is created, a video&apos;s when that video format is added. A number never changes.</li>
        <li>Songs released before this (and Main and Community songs) keep the ISRC their distributor gave them.</li>
      </ul>
    </div>
  );
}
