import type { DeliverableKind } from "@/lib/types";
import { ART_DEFAULTS, CAROUSEL_DEFAULTS, LANDSCAPE_DEFAULTS, MIX_DEFAULTS, VERTICAL_DEFAULTS } from "./judge";

/**
 * The audit rules people can edit, in plain words. A field is one number, or a pair (e.g. "from … to").
 * Anything in the stored rules that isn't listed here (shape, allowed formats) is left as it is.
 */
export type RuleField = { key: string; label: string; unit: string; hint?: string; pair?: [string, string]; step?: number; min?: number; max?: number; options?: number[] };
export type RuleGroup = { id: string; title: string; about: string; kinds: DeliverableKind[]; defaults: Record<string, unknown>; fields: RuleField[] };

const video = (wide: boolean): RuleField[] => [
  { key: "warn_short_px", label: "Sharp enough from", unit: "p", hint: "Shorter side in pixels. Below this the audit warns.", min: 240, max: 4320 },
  { key: "min_short_px", label: "Too small below", unit: "p", hint: "Below this the audit fails.", min: 240, max: 4320 },
  { key: "fps", label: "Frame rate", unit: "fps", pair: ["from", "to"], min: 1, max: 240 },
  { key: "duration_s", label: "Good length", unit: "seconds", pair: ["from", "to"], hint: wide ? "Full videos outside this range get a warning." : "Reels and Shorts outside this range get a warning.", min: 1, max: 7200 },
  { key: "duration_warn_s", label: "Fails when longer than", unit: "seconds", min: 1, max: 14400 },
  { key: "min_mbps", label: "Lowest good bitrate", unit: "Mbps", hint: "Below this the file is probably over-compressed.", step: 0.5, min: 0, max: 200 },
];

export const RULE_GROUPS: RuleGroup[] = [
  {
    id: "mix", title: "Master WAV", about: "Used by the mix audit.", kinds: ["master_wav"], defaults: MIX_DEFAULTS,
    fields: [
      { key: "lufs_pass", label: "Loudness: pass", unit: "LUFS", pair: ["from", "to"], hint: "Numbers are negative. Closer to 0 is louder.", step: 0.5, min: -40, max: 0 },
      { key: "lufs_warn", label: "Loudness: warning", unit: "LUFS", pair: ["from", "to"], hint: "Outside the pass range but inside this one is a warning. Outside this is a fail.", step: 0.5, min: -40, max: 0 },
      { key: "tp_max_dbtp", label: "True peak limit", unit: "dBTP", hint: "Peaks above this fail.", step: 0.1, min: -12, max: 0 },
      { key: "tp_max_if_loud_dbtp", label: "True peak limit for loud masters", unit: "dBTP", step: 0.1, min: -12, max: 0 },
      { key: "loud_above_lufs", label: "A master counts as loud above", unit: "LUFS", step: 0.5, min: -40, max: 0 },
      { key: "lra_min", label: "Smallest loudness range", unit: "LU", hint: "Below this the song is flagged as too flat.", step: 0.5, min: 0, max: 30 },
      { key: "bit_depth_pref", label: "Preferred bit depth", unit: "bit", options: [16, 24, 32] },
      { key: "bit_depth_min", label: "Lowest accepted bit depth", unit: "bit", options: [16, 24, 32] },
      { key: "sample_rate_min", label: "Lowest sample rate", unit: "Hz", options: [44100, 48000, 88200, 96000] },
      { key: "clip_runs_warn", label: "Clipped spots: warning from", unit: "spots", min: 1, max: 1000 },
      { key: "clip_runs_fail", label: "Clipped spots: fail from", unit: "spots", min: 1, max: 1000 },
      { key: "phase_warn", label: "Mono compatibility: pass above", unit: "", hint: "From −1 to +1. +1 is fully mono-safe.", step: 0.05, min: -1, max: 1 },
      { key: "phase_fail", label: "Mono compatibility: fail below", unit: "", step: 0.05, min: -1, max: 1 },
      { key: "dc_warn_pct", label: "DC offset: warning from", unit: "%", step: 0.05, min: 0, max: 10 },
      { key: "dc_fail_pct", label: "DC offset: fail from", unit: "%", step: 0.05, min: 0, max: 10 },
      { key: "head_silence_s", label: "Silence at the start", unit: "seconds", pair: ["pass up to", "fail above"], step: 0.1, min: 0, max: 30 },
      { key: "tail_silence_s", label: "Silence at the end", unit: "seconds", pair: ["pass up to", "fail above"], step: 0.1, min: 0, max: 60 },
      { key: "duration_tol_s", label: "Length may differ from the song details by", unit: "seconds", step: 0.5, min: 0, max: 30 },
    ],
  },
  {
    id: "artwork", title: "Artwork", about: "Used by the artwork audit.", kinds: ["artwork"], defaults: ART_DEFAULTS,
    fields: [
      { key: "size_px", label: "Target size (each side)", unit: "px", min: 500, max: 10000 },
      { key: "min_px", label: "Too small below", unit: "px", hint: "Between this and the target is a warning.", min: 500, max: 10000 },
      { key: "max_mb", label: "Largest file size", unit: "MB", min: 1, max: 100 },
    ],
  },
  { id: "vertical", title: "Vertical videos", about: "Reels and Shorts. Used by the video audit.", kinds: ["vertical"], defaults: VERTICAL_DEFAULTS, fields: video(false) },
  { id: "wide", title: "Wide videos", about: "Lyric video, visualizer, music video and AI music video. Used by the video audit.", kinds: ["lyric_video", "visualizer", "music_video", "ai_music_video"], defaults: LANDSCAPE_DEFAULTS, fields: video(true) },
  {
    id: "carousel", title: "Carousels", about: "Used by the carousel audit.", kinds: ["carousel"], defaults: CAROUSEL_DEFAULTS,
    fields: [
      { key: "slides", label: "Number of slides", unit: "slides", pair: ["from", "to"], min: 1, max: 20 },
      { key: "min_width_px", label: "Slides at least this wide", unit: "px", min: 320, max: 8000 },
    ],
  },
];
