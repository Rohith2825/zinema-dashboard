/**
 * Reads the facts of an MP4 / MOV video (size, frame rate, length, codecs, audio) from its index
 * (the "moov" box) without ffprobe and without downloading the video itself.
 */

export type VideoMetrics = {
  container: "mp4" | "mov";
  width: number; height: number; // as displayed (rotation applied)
  duration_s: number;
  fps: number | null;
  video_codec: string | null;
  has_audio: boolean;
  audio_codec: string | null; audio_channels: number | null; audio_sample_rate: number | null;
  bitrate_mbps: number | null;
  size_bytes: number;
};

export class NotVideoError extends Error {
  detected: string;
  constructor(detected: string) {
    super(`This is ${detected}, not an MP4 or MOV video.`);
    this.detected = detected;
  }
}

type Read = (start: number, end: number) => Promise<Buffer>;
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
const CODEC: Record<string, string> = { avc1: "H.264", avc3: "H.264", hvc1: "H.265 (HEVC)", hev1: "H.265 (HEVC)", av01: "AV1", vp09: "VP9", mp4v: "MPEG-4", apcn: "ProRes", apch: "ProRes", apcs: "ProRes", ap4h: "ProRes", "mp4a": "AAC", "ac-3": "AC-3", "ec-3": "E-AC-3", Opus: "Opus", sowt: "PCM", twos: "PCM", lpcm: "PCM" };

/** Finds the index box by hopping from box to box, then parses it. */
export async function probeVideo(read: Read, size: number): Promise<VideoMetrics> {
  const first = await read(0, Math.min(size, 16) - 1);
  if (first.length < 12) throw new NotVideoError("an empty file");
  const tag = first.toString("latin1", 4, 8);
  if (!["ftyp", "moov", "mdat", "free", "wide", "skip"].includes(tag)) {
    throw new NotVideoError(first.readUInt32BE(0) === 0x1a45dfa3 ? "a WebM/MKV video" : first.toString("latin1", 0, 4) === "RIFF" ? (first.toString("latin1", 8, 12) === "WAVE" ? "an audio (WAV) file" : "an AVI file") : "an unrecognised file");
  }
  const brand = tag === "ftyp" ? first.toString("latin1", 8, 12) : "";
  let moov: Buffer | null = null;
  for (let o = 0, hops = 0; o + 8 <= size && hops < 200; hops++) {
    const h = o === 0 ? first : await read(o, Math.min(size, o + 16) - 1);
    let len = h.readUInt32BE(0), head = 8;
    if (len === 1 && h.length >= 16) { len = Number(h.readBigUInt64BE(8)); head = 16; }
    if (len === 0) len = size - o;
    if (len < head) break;
    if (h.toString("latin1", 4, 8) === "moov") {
      if (len > 64 * 1048576) throw new NotVideoError("a video with an unusually large index");
      moov = await read(o + head, o + len - 1);
      break;
    }
    o += len;
  }
  if (!moov) throw new NotVideoError("a video file that is incomplete (it has no index; the export may have been cut off)");

  const out: VideoMetrics = { container: brand.startsWith("qt") ? "mov" : "mp4", width: 0, height: 0, duration_s: 0, fps: null, video_codec: null, has_audio: false, audio_codec: null, audio_channels: null, audio_sample_rate: null, bitrate_mbps: null, size_bytes: size };
  type Trak = { w: number; h: number; rotated: boolean; handler: string; timescale: number; duration: number; samples: number; codec: string; ew: number; eh: number; ch: number; rate: number };
  const traks: Trak[] = [];
  let cur: Trak | null = null;

  const walk = (b: Buffer, start: number, end: number) => {
    for (let o = start; o + 8 <= end; ) {
      let len = b.readUInt32BE(o), head = 8;
      const type = b.toString("latin1", o + 4, o + 8);
      if (len === 1) { len = Number(b.readBigUInt64BE(o + 8)); head = 16; }
      if (len === 0) len = end - o;
      if (len < head || o + len > end) break;
      const p = o + head, v = b[p]; // body start, version
      if (type === "trak") { cur = { w: 0, h: 0, rotated: false, handler: "", timescale: 0, duration: 0, samples: 0, codec: "", ew: 0, eh: 0, ch: 0, rate: 0 }; traks.push(cur); }
      if (type === "mvhd") {
        const ts = b.readUInt32BE(p + (v === 1 ? 20 : 12)), d = v === 1 ? Number(b.readBigUInt64BE(p + 24)) : b.readUInt32BE(p + 16);
        if (ts) out.duration_s = d / ts;
      } else if (cur && type === "tkhd") {
        const m = p + (v === 1 ? 52 : 40);
        cur.rotated = b.readInt32BE(m) === 0 && b.readInt32BE(m + 4) !== 0;
        cur.w = b.readUInt32BE(m + 36) / 65536; cur.h = b.readUInt32BE(m + 40) / 65536;
      } else if (cur && type === "mdhd") {
        cur.timescale = b.readUInt32BE(p + (v === 1 ? 20 : 12));
        cur.duration = v === 1 ? Number(b.readBigUInt64BE(p + 24)) : b.readUInt32BE(p + 16);
      } else if (cur && type === "hdlr") {
        if (!cur.handler) cur.handler = b.toString("latin1", p + 8, p + 12); // MOV files carry a second, unrelated handler box
      } else if (cur && type === "stsd" && b.readUInt32BE(p + 4) > 0) {
        const e = p + 8;
        cur.codec = b.toString("latin1", e + 4, e + 8);
        if (cur.handler === "vide") { cur.ew = b.readUInt16BE(e + 32); cur.eh = b.readUInt16BE(e + 34); }
        if (cur.handler === "soun") { cur.ch = b.readUInt16BE(e + 24); cur.rate = b.readUInt32BE(e + 32) / 65536; }
      } else if (cur && type === "stts") {
        const n = b.readUInt32BE(p + 4);
        for (let i = 0; i < n && p + 16 + i * 8 <= o + len; i++) cur.samples += b.readUInt32BE(p + 8 + i * 8);
      }
      if (CONTAINERS.has(type)) walk(b, p, o + len);
      o += len;
    }
  };
  walk(moov, 0, moov.length);

  const video = traks.find((t) => t.handler === "vide");
  const audio = traks.find((t) => t.handler === "soun");
  if (!video) throw new NotVideoError(audio ? "an audio-only file" : "a file with no picture");
  const w = Math.round(video.w || video.ew), h = Math.round(video.h || video.eh);
  out.width = video.rotated ? h : w; out.height = video.rotated ? w : h;
  const secs = video.timescale ? video.duration / video.timescale : 0;
  if (!out.duration_s) out.duration_s = secs;
  out.fps = secs > 0 && video.samples ? Math.round((video.samples / secs) * 100) / 100 : null;
  out.video_codec = CODEC[video.codec] ?? video.codec.trim() ?? null;
  out.has_audio = Boolean(audio);
  if (audio) { out.audio_codec = CODEC[audio.codec] ?? audio.codec.trim(); out.audio_channels = audio.ch || null; out.audio_sample_rate = audio.rate || null; }
  out.duration_s = Math.round(out.duration_s * 100) / 100;
  out.bitrate_mbps = out.duration_s ? Math.round(((size * 8) / out.duration_s / 1e6) * 10) / 10 : null;
  return out;
}
