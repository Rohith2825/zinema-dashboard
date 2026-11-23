import type { WavMetrics } from "./wav";

/**
 * Turns measurements into pass / warn / fail findings using the page's thresholds.
 * No AI here: the same file always gets the same result.
 */

export type Status = "pass" | "warn" | "fail" | "info";
export type Finding = { check: string; status: Status; value: string; target: string; fix?: string };
export type Verdict = "pass" | "warn" | "fail" | "error";

export const verdictOf = (f: Finding[]): Verdict => (f.some((x) => x.status === "fail") ? "fail" : f.some((x) => x.status === "warn") ? "warn" : "pass");

export type MixRules = {
  lufs_pass: [number, number]; lufs_warn: [number, number];
  tp_max_dbtp: number; tp_max_if_loud_dbtp: number; loud_above_lufs: number;
  lra_min: number; bit_depth_min: number; bit_depth_pref: number; sample_rate_min: number; channels: number;
  clip_runs_warn: number; clip_runs_fail: number; phase_warn: number; phase_fail: number;
  dc_warn_pct: number; dc_fail_pct: number; head_silence_s: [number, number]; tail_silence_s: [number, number]; duration_tol_s: number;
};
export const MIX_DEFAULTS: MixRules = {
  lufs_pass: [-14, -9], lufs_warn: [-16, -7], tp_max_dbtp: -1, tp_max_if_loud_dbtp: -2, loud_above_lufs: -14,
  lra_min: 4, bit_depth_min: 16, bit_depth_pref: 24, sample_rate_min: 44100, channels: 2,
  clip_runs_warn: 1, clip_runs_fail: 4, phase_warn: 0.3, phase_fail: 0, dc_warn_pct: 0.1, dc_fail_pct: 0.5,
  head_silence_s: [0.5, 2], tail_silence_s: [3, 6], duration_tol_s: 1,
};

const n = (x: number, dp = 1) => (Object.is(Math.round(x * 10 ** dp), -0) ? 0 : Math.round(x * 10 ** dp) / 10 ** dp).toFixed(dp).replace("-", "−");
const khz = (hz: number) => `${hz / 1000} kHz`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Where streaming services play a track back; anything louder gets turned down by the difference. */
const PLATFORM_TARGETS = [["Spotify", -14], ["YouTube", -14], ["Apple Music", -16]] as const;

export function judgeMix(m: WavMetrics, rules: Partial<MixRules> | null, expectedDurationS?: number | null): Finding[] {
  const r = { ...MIX_DEFAULTS, ...(rules ?? {}) };
  const out: Finding[] = [];
  const add = (check: string, status: Status, value: string, target: string, fix?: string) => out.push({ check, status, value, target, ...(fix && status !== "pass" ? { fix } : {}) });

  add("File format", m.channels === r.channels ? "pass" : "fail", `WAV, ${m.channels === 1 ? "mono" : m.channels === 2 ? "stereo" : `${m.channels} channels`}`, "WAV, stereo",
    m.channels === 1 ? "Export the master as a stereo WAV, not mono." : "Export a plain stereo WAV (two channels).");

  add("Bit depth", m.bit_depth >= r.bit_depth_pref ? "pass" : m.bit_depth >= r.bit_depth_min ? "warn" : "fail",
    `${m.bit_depth}-bit${m.codec === "float" ? " float" : ""}`, `${r.bit_depth_pref}-bit`,
    m.bit_depth >= r.bit_depth_min ? `Accepted, but export at ${r.bit_depth_pref}-bit if the session allows it — stores then show the song as hi-res.` : `Re-export at ${r.bit_depth_pref}-bit.`);

  add("Sample rate", m.sample_rate >= r.sample_rate_min ? "pass" : "fail", khz(m.sample_rate), `${khz(r.sample_rate_min)} or higher`,
    `Re-export at ${khz(r.sample_rate_min)} or 48 kHz.`);

  if (m.integrated_lufs === null) {
    add("Loudness", "fail", "silent", `${n(r.lufs_pass[0], 0)} to ${n(r.lufs_pass[1], 0)} LUFS`, "The file has no audible sound. Check the export.");
  } else {
    const l = m.integrated_lufs, [p0, p1] = r.lufs_pass, [w0, w1] = r.lufs_warn;
    const status: Status = l >= p0 && l <= p1 ? "pass" : l >= w0 && l <= w1 ? "warn" : "fail";
    const turned = PLATFORM_TARGETS.filter(([, t]) => l > t).map(([name, t]) => `${name} by ${n(l - t)} dB`);
    const fix = l > p1
      ? `Bring the level down by about ${n(l - p1)} dB. Streaming services turn loud songs down anyway (${turned.join(", ")}), so the extra loudness only costs punch.`
      : `Raise the level by about ${n(p0 - l)} dB so it doesn't sound quieter than other songs.`;
    add("Loudness", status, `${n(l)} LUFS`, `${n(p0, 0)} to ${n(p1, 0)} LUFS`, fix);
    if (status === "pass" && turned.length) add("Streaming playback", "info", `turned down: ${turned.join(", ")}`, "for information");
  }

  if (m.true_peak_dbtp !== null) {
    const loud = (m.integrated_lufs ?? -99) > r.loud_above_lufs;
    const limit = loud ? r.tp_max_if_loud_dbtp : r.tp_max_dbtp;
    const tp = m.true_peak_dbtp;
    add("True peak", tp <= limit ? "pass" : tp <= r.tp_max_dbtp ? "warn" : "fail", `${n(tp)} dBTP`, `${n(limit)} dBTP or lower${loud ? " (loud master)" : ""}`,
      `Set the limiter's ceiling to ${n(limit)} dBTP with true-peak mode on (lower it by ${n(tp - limit)} dB). Otherwise the MP3/AAC versions made by the stores can distort.`);
  }

  add("Clipping", m.clip_runs < r.clip_runs_warn ? "pass" : m.clip_runs < r.clip_runs_fail ? "warn" : "fail",
    m.clip_runs === 0 ? "none" : `${m.clip_runs} clipped spot${m.clip_runs === 1 ? "" : "s"}`, "none",
    "The signal is hitting the ceiling and flattening. Lower the level going into the limiter, or reduce the gain before export.");

  if (m.loudness_range_lu !== null)
    add("Loudness range", m.loudness_range_lu >= r.lra_min ? "pass" : "warn", `${n(m.loudness_range_lu)} LU`, `${n(r.lra_min, 0)} LU or more`,
      "The song is the same loudness from start to end. Ease off compression so the quiet parts and the chorus feel different.");

  if (m.phase_correlation !== null)
    add("Mono compatibility", m.phase_correlation > r.phase_warn ? "pass" : m.phase_correlation >= r.phase_fail ? "warn" : "fail", `${m.phase_correlation > 0 ? "+" : ""}${n(m.phase_correlation, 2)}`, `above +${r.phase_warn}`,
      "Left and right partly cancel when played on one speaker (phones, shop speakers). Narrow the stereo widening, or check a channel isn't flipped.");

  add("DC offset", m.dc_offset_pct < r.dc_warn_pct ? "pass" : m.dc_offset_pct < r.dc_fail_pct ? "warn" : "fail", `${n(m.dc_offset_pct, 2)} %`, `under ${r.dc_warn_pct} %`,
    "The waveform sits off-centre, which wastes headroom. Add a high-pass / DC-removal filter on the master.");

  add("Silence at start", m.head_silence_s <= r.head_silence_s[0] ? "pass" : m.head_silence_s <= r.head_silence_s[1] ? "warn" : "fail", `${n(m.head_silence_s, 2)} s`, `${r.head_silence_s[0]} s or less`,
    "Trim the silence at the start so the song begins as soon as someone presses play.");
  add("Silence at end", m.tail_silence_s <= r.tail_silence_s[0] ? "pass" : m.tail_silence_s <= r.tail_silence_s[1] ? "warn" : "fail", `${n(m.tail_silence_s, 2)} s`, `${r.tail_silence_s[0]} s or less`,
    "Trim the silence at the end.");

  if (expectedDurationS)
    add("Length", Math.abs(m.duration_s - expectedDurationS) <= r.duration_tol_s ? "pass" : "fail", clock(m.duration_s), `${clock(expectedDurationS)} (song details)`,
      "The length doesn't match the song's details. Check this is the right file.");
  else add("Length", "info", clock(m.duration_s), "for information");

  return out;
}

export type ArtRules = { size_px: number; min_px: number; max_mb: number; formats: string[] };
export const ART_DEFAULTS: ArtRules = { size_px: 3000, min_px: 1400, max_mb: 10, formats: ["jpeg", "png"] };
export type ArtMetrics = { format: string; width: number; height: number; colour: string; has_alpha: boolean; size_bytes: number; dpi: number | null };

export function judgeArtwork(m: ArtMetrics, rules: Partial<ArtRules> | null): Finding[] {
  const r = { ...ART_DEFAULTS, ...(rules ?? {}) };
  const out: Finding[] = [];
  const add = (check: string, status: Status, value: string, target: string, fix?: string) => out.push({ check, status, value, target, ...(fix && status !== "pass" ? { fix } : {}) });
  const label = (f: string) => (f === "jpeg" ? "JPG" : f.toUpperCase());

  add("File type", r.formats.includes(m.format) ? "pass" : "fail", label(m.format), r.formats.map(label).join(" or "), `Export the cover as ${r.formats.map(label).join(" or ")}.`);
  add("Square", m.width === m.height ? "pass" : "fail", `${m.width} × ${m.height}`, "same width and height", "Crop or re-export the cover as an exact square.");
  const short = Math.min(m.width, m.height);
  add("Size", short >= r.size_px ? "pass" : short >= r.min_px ? "warn" : "fail", `${m.width} × ${m.height} px`, `${r.size_px} × ${r.size_px} px`,
    short >= r.min_px ? `Stores accept this, but export at ${r.size_px} × ${r.size_px} so it stays sharp on big screens.` : `Too small for stores. Export at ${r.size_px} × ${r.size_px}.`);
  add("Colour", m.colour === "rgb" ? "pass" : "fail", m.colour === "rgb" ? "RGB" : m.colour.toUpperCase(), "RGB",
    m.colour === "cmyk" ? "This is a print (CMYK) file; colours will look wrong on screens. Export as RGB." : "Export the cover in RGB colour.");
  add("Transparency", m.has_alpha ? "fail" : "pass", m.has_alpha ? "has transparent areas" : "none", "none", "Flatten the image onto a solid background before export.");
  const mb = m.size_bytes / 1048576;
  add("File size", mb <= r.max_mb ? "pass" : "fail", `${mb.toFixed(1)} MB`, `under ${r.max_mb} MB`, "Save as JPG at high quality to bring the size down.");
  return out;
}

const ICON: Record<Status, string> = { pass: "✅", warn: "⚠️", fail: "❌", info: "ℹ️" };

/** A short written report, saved with the audit so it reads the same in the dashboard and in Claude. */
export function reportMd(title: string, findings: Finding[], notes?: string): string {
  const fixes = findings.filter((f) => f.fix);
  const v = verdictOf(findings);
  const lines = [
    `## ${title}: ${v === "pass" ? "ready" : v === "warn" ? "usable, with things to look at" : "needs fixing"}`,
    "",
    ...findings.map((f) => `- ${ICON[f.status]} **${f.check}**: ${f.value}${f.status === "info" ? "" : ` (target: ${f.target})`}`),
  ];
  if (fixes.length) lines.push("", "### What to fix", ...fixes.map((f) => `- **${f.check}**: ${f.fix}`));
  if (notes) lines.push("", notes);
  return lines.join("\n");
}

// ───────────── Video ─────────────
export type VideoRules = {
  aspect: [number, number]; min_short_px: number; warn_short_px: number; fps: [number, number];
  duration_s: [number, number]; duration_warn_s: number; min_mbps: number; codecs: string[];
};
export const VERTICAL_DEFAULTS: VideoRules = { aspect: [9, 16], min_short_px: 720, warn_short_px: 1080, fps: [24, 60], duration_s: [5, 90], duration_warn_s: 180, min_mbps: 3, codecs: ["H.264", "H.265 (HEVC)"] };
export const LANDSCAPE_DEFAULTS: VideoRules = { aspect: [16, 9], min_short_px: 720, warn_short_px: 1080, fps: [24, 60], duration_s: [20, 900], duration_warn_s: 1200, min_mbps: 5, codecs: ["H.264", "H.265 (HEVC)", "ProRes"] };
export type VideoFacts = { width: number; height: number; duration_s: number; fps: number | null; video_codec: string | null; has_audio: boolean; audio_codec: string | null; bitrate_mbps: number | null; size_bytes: number; container: string };

export function judgeVideo(m: VideoFacts, rules: Partial<VideoRules> | null, vertical: boolean, songDurationS?: number | null): Finding[] {
  const r = { ...(vertical ? VERTICAL_DEFAULTS : LANDSCAPE_DEFAULTS), ...(rules ?? {}) };
  const out: Finding[] = [];
  const add = (check: string, status: Status, value: string, target: string, fix?: string) => out.push({ check, status, value, target, ...(fix && status !== "pass" ? { fix } : {}) });
  const [aw, ah] = r.aspect, want = aw / ah, got = m.width / m.height;
  const shape = `${aw}:${ah} (${vertical ? "upright" : "wide"})`;

  add("File type", "pass", m.container.toUpperCase(), "MP4 or MOV");
  add("Shape", Math.abs(got - want) / want <= 0.02 ? "pass" : "fail", `${m.width} × ${m.height}`, shape,
    vertical ? "Reels and Shorts need an upright 9:16 video (1080 × 1920). Re-export in that shape, don't just rotate." : "Export the video in 16:9 (1920 × 1080).");
  const short = Math.min(m.width, m.height);
  add("Sharpness", short >= r.warn_short_px ? "pass" : short >= r.min_short_px ? "warn" : "fail", `${short}p`, `${r.warn_short_px}p or more`,
    short >= r.min_short_px ? `It will look soft on new phones. Export at ${vertical ? "1080 × 1920" : "1920 × 1080"}.` : `Too small. Export at ${vertical ? "1080 × 1920" : "1920 × 1080"}.`);
  if (m.fps !== null)
    add("Frame rate", m.fps >= r.fps[0] - 0.1 && m.fps <= r.fps[1] + 0.1 ? "pass" : "warn", `${n(m.fps, m.fps % 1 ? 2 : 0)} fps`, `${r.fps[0]} to ${r.fps[1]} fps`,
      m.fps < r.fps[0] ? "Movement will look jerky. Export at 25 or 30 fps." : "Very high frame rates get reduced by the apps. Export at 30 or 60 fps.");
  const d = m.duration_s, [d0, d1] = r.duration_s;
  add("Length", d >= d0 && d <= d1 ? "pass" : d <= r.duration_warn_s && d >= d0 / 2 ? "warn" : "fail", clock(d), `${clock(d0)} to ${clock(d1)}`,
    d < d0 ? "This is very short. Check the export didn't get cut off." : vertical ? "Instagram shows reels over 90 seconds to fewer people, and Shorts stop at 3 minutes. Cut it shorter." : "Longer than expected for this kind of video. Check it's the right file.");
  if (!vertical && songDurationS)
    add("Matches the song", Math.abs(d - songDurationS) <= 8 ? "pass" : "warn", clock(d), `about ${clock(songDurationS)} (the song's length)`,
      "The video is a different length from the song. Check the full song is in it, with no long blank start or end.");
  add("Sound", m.has_audio ? "pass" : "fail", m.has_audio ? m.audio_codec ?? "yes" : "no sound track", "has sound", "The video has no sound. Export it again with the song's audio included.");
  if (m.video_codec)
    add("Video format", r.codecs.includes(m.video_codec) ? "pass" : "warn", m.video_codec, r.codecs.slice(0, 2).join(" or "), "Some apps reject or re-compress this format badly. Export as H.264 MP4.");
  if (m.bitrate_mbps !== null)
    add("Quality (bitrate)", m.bitrate_mbps >= r.min_mbps ? "pass" : "warn", `${n(m.bitrate_mbps)} Mbps`, `${r.min_mbps} Mbps or more`,
      "The file is heavily compressed and may look blocky after the apps compress it again. Export at a higher quality setting.");
  add("File size", "info", `${(m.size_bytes / 1048576).toFixed(m.size_bytes > 10485760 ? 0 : 1)} MB`, "for information");
  return out;
}

// ───────────── Carousel ─────────────
export type CarouselRules = { slides: [number, number]; ratios: [number, number][]; min_width_px: number };
export const CAROUSEL_DEFAULTS: CarouselRules = { slides: [3, 20], ratios: [[4, 5], [1, 1], [3, 4]], min_width_px: 1080 };
export type Slide = { name: string; width: number; height: number; colour: string };

export function judgeCarousel(slides: Slide[], rules: Partial<CarouselRules> | null): Finding[] {
  const r = { ...CAROUSEL_DEFAULTS, ...(rules ?? {}) };
  const out: Finding[] = [];
  const add = (check: string, status: Status, value: string, target: string, fix?: string) => out.push({ check, status, value, target, ...(fix && status !== "pass" ? { fix } : {}) });
  const names = (xs: Slide[]) => xs.slice(0, 4).map((s) => s.name).join(", ") + (xs.length > 4 ? ` and ${xs.length - 4} more` : "");
  const shapes = r.ratios.map(([a, b]) => `${a}:${b}`).join(", ");

  add("Slides", slides.length >= r.slides[0] && slides.length <= r.slides[1] ? "pass" : slides.length > r.slides[1] ? "fail" : "warn", `${slides.length}`, `${r.slides[0]} to ${r.slides[1]}`,
    slides.length > r.slides[1] ? `Instagram takes at most ${r.slides[1]} slides. Remove some.` : `A carousel works best with at least ${r.slides[0]} slides. Put all the slide images in the folder you submit.`);
  const sizes = new Set(slides.map((s) => `${s.width} × ${s.height}`));
  add("Same size", sizes.size === 1 ? "pass" : "fail", sizes.size === 1 ? [...sizes][0] : `${sizes.size} different sizes`, "every slide the same size",
    "Instagram crops every slide to match the first one, so text gets cut off. Export all slides at one size.");
  const wrong = slides.filter((s) => !r.ratios.some(([a, b]) => Math.abs(s.width / s.height - a / b) / (a / b) <= 0.01));
  add("Shape", wrong.length ? "fail" : "pass", wrong.length ? `wrong shape: ${names(wrong)}` : "ok", shapes, "Use 1080 × 1350 (4:5), which fills the most screen, or 1080 × 1080 (square).");
  const small = slides.filter((s) => s.width < r.min_width_px);
  add("Sharpness", small.length ? "warn" : "pass", small.length ? `under ${r.min_width_px} px wide: ${names(small)}` : `${Math.min(...slides.map((s) => s.width))} px wide or more`, `${r.min_width_px} px wide or more`,
    "Export the slides at 1080 px wide or more so text stays sharp.");
  const colour = slides.filter((s) => s.colour !== "rgb");
  add("Colour", colour.length ? "fail" : "pass", colour.length ? `not RGB: ${names(colour)}` : "RGB", "RGB", "Export the slides in RGB colour (not CMYK print colour).");
  return out;
}
