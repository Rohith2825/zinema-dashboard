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
