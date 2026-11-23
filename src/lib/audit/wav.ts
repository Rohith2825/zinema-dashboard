/**
 * Measures a WAV master without ffmpeg, reading it as a stream so a 100 MB file never sits in memory.
 * Loudness follows ITU-R BS.1770-4 / EBU R128 (K-weighting, 400 ms blocks, −70 LUFS and −10 LU gates),
 * loudness range follows EBU Tech 3342, and true peak is taken from a 4× oversampled signal.
 * Checked against `ffmpeg -af ebur128=peak=true` (see scripts/audit-selftest.mjs).
 */

export type WavMetrics = {
  container: "wav";
  codec: "pcm" | "float";
  channels: number;
  sample_rate: number;
  bit_depth: number;
  duration_s: number;
  integrated_lufs: number | null; // null when the file is silent
  loudness_range_lu: number | null;
  true_peak_dbtp: number | null;
  sample_peak_dbfs: number | null;
  clip_runs: number; // runs of 3+ consecutive full-scale samples
  phase_correlation: number | null; // stereo only: +1 mono-safe … −1 cancels in mono
  dc_offset_pct: number;
  head_silence_s: number;
  tail_silence_s: number;
};

export class NotWavError extends Error {
  detected: string;
  constructor(detected: string) {
    super(`This is ${detected}, not a WAV file.`);
    this.detected = detected;
  }
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : null);
const lufs = (energy: number) => -0.691 + 10 * Math.log10(energy);
const round = (x: number | null, dp = 2) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10 ** dp) / 10 ** dp);

/** Two biquads that make up the K-weighting curve, for any sample rate. */
function kWeighting(fs: number) {
  let f0 = 1681.974450955533, q = 0.7071752369554196, k = Math.tan((Math.PI * f0) / fs);
  const vh = 10 ** (3.999843853973347 / 20), vb = vh ** 0.4996667741545416;
  let a0 = 1 + k / q + k * k;
  const shelf = [(vh + (vb * k) / q + k * k) / a0, (2 * (k * k - vh)) / a0, (vh - (vb * k) / q + k * k) / a0, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0];
  f0 = 38.13547087602444; q = 0.5003270373238773; k = Math.tan((Math.PI * f0) / fs);
  a0 = 1 + k / q + k * k;
  const highpass = [1, -2, 1, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0];
  return { shelf, highpass };
}

const TAPS = 12;
/** The three in-between phases of a 4× interpolation filter (Kaiser-windowed sinc, 49 points). */
const PHASES: Float64Array[] = (() => {
  const i0 = (x: number) => {
    let sum = 1, term = 1;
    for (let n = 1; n < 30; n++) { term *= (x / (2 * n)) ** 2; sum += term; }
    return sum;
  };
  const beta = 8, centre = 24;
  return [1, 2, 3].map((p) => {
    const h = new Float64Array(TAPS);
    for (let j = 0; j < TAPS; j++) {
      const n = p + 4 * j, t = (n - centre) / 4, r = (n - centre) / centre;
      h[j] = (Math.sin(Math.PI * t) / (Math.PI * t)) * (i0(beta * Math.sqrt(1 - r * r)) / i0(beta));
    }
    return h;
  });
})();

type Format = { codec: "pcm" | "float"; channels: number; rate: number; bits: number; blockAlign: number };

function sniff(b: Uint8Array): string {
  const tag = String.fromCharCode(...b.subarray(0, 4));
  if (tag === "ID3" + tag[3] || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "an MP3";
  if (tag === "fLaC") return "a FLAC file";
  if (tag === "FORM") return "an AIFF file";
  if (tag === "OggS") return "an Ogg file";
  if (tag === "RF64") return "an RF64 (over 4 GB) file";
  if (String.fromCharCode(...b.subarray(4, 8)) === "ftyp") return "an M4A/AAC or MP4 file";
  return "an unrecognised file";
}

export class WavAnalyzer {
  private head: Uint8Array | null = new Uint8Array(0);
  private fmt: Format | null = null;
  private dataLeft = 0;
  private carry = new Uint8Array(0);

  // running state (two analysed channels at most)
  private n = 2;
  private frames = 0;
  private sum = [0, 0];
  private peak = 0;
  private tp = 0;
  private clipLevel = 1;
  private run = [0, 0];
  private clipRuns = 0;
  private firstLoud = -1;
  private lastLoud = -1;
  private sLR = 0; private sLL = 0; private sRR = 0;
  private bq = new Float64Array(8); // per channel: shelf z1,z2, highpass z1,z2
  private c1: number[] = []; private c2: number[] = [];
  private ring = [new Float64Array(TAPS * 2), new Float64Array(TAPS * 2)];
  private ringPos = 0;
  private subLen = 0; private subFill = 0; private subAcc = 0;
  private sub: number[] = []; // mean-square energy of each 100 ms slice, channels summed

  push(chunk: Uint8Array) {
    let buf = chunk;
    if (this.head) {
      const joined = new Uint8Array(this.head.length + chunk.length);
      joined.set(this.head); joined.set(chunk, this.head.length);
      const start = this.parseHeader(joined);
      if (start < 0) {
        if (joined.length > 4_000_000) throw new NotWavError("a WAV file with no audio data");
        this.head = joined;
        return;
      }
      this.head = null;
      buf = joined.subarray(start);
    }
    if (!this.fmt || this.dataLeft <= 0) return;
    if (buf.length > this.dataLeft) buf = buf.subarray(0, this.dataLeft);
    this.dataLeft -= buf.length;
    if (this.carry.length) {
      const joined = new Uint8Array(this.carry.length + buf.length);
      joined.set(this.carry); joined.set(buf, this.carry.length);
      buf = joined;
    }
    const usable = buf.length - (buf.length % this.fmt.blockAlign);
    this.process(buf, usable);
    this.carry = buf.slice(usable);
  }

  /** Returns the offset of the first audio byte, or −1 if more of the file is needed. */
  private parseHeader(b: Uint8Array): number {
    if (b.length < 12) return -1;
    const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
    if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new NotWavError(sniff(b));
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let o = 12;
    while (o + 8 <= b.length) {
      const id = tag(o), size = v.getUint32(o + 4, true);
      if (id === "fmt ") {
        if (o + 8 + size > b.length) return -1;
        let code = v.getUint16(o + 8, true);
        const channels = v.getUint16(o + 10, true), rate = v.getUint32(o + 12, true), blockAlign = v.getUint16(o + 20, true), bits = v.getUint16(o + 22, true);
        if (code === 0xfffe && size >= 26) code = v.getUint16(o + 32, true); // extensible: real format is in the sub-format
        if (code !== 1 && code !== 3) throw new NotWavError("a compressed WAV (not plain PCM)");
        if (!channels || !rate || !blockAlign || ![8, 16, 24, 32, 64].includes(bits)) throw new NotWavError("a WAV file with an unreadable header");
        this.fmt = { codec: code === 3 ? "float" : "pcm", channels, rate, bits, blockAlign };
      } else if (id === "data") {
        if (!this.fmt) throw new NotWavError("a WAV file with an unreadable header");
        this.dataLeft = size === 0 || size === 0xffffffff ? Number.MAX_SAFE_INTEGER : size;
        this.begin(this.fmt);
        return o + 8;
      }
      o += 8 + size + (size % 2);
    }
    return -1;
  }

  private begin(f: Format) {
    this.n = Math.min(2, f.channels);
    const { shelf, highpass } = kWeighting(f.rate);
    this.c1 = shelf; this.c2 = highpass;
    this.subLen = Math.round(f.rate / 10);
    this.clipLevel = f.codec === "float" ? 1 : (2 ** (f.bits - 1) - 1.5) / 2 ** (f.bits - 1);
  }

  private process(b: Uint8Array, len: number) {
    const f = this.fmt!, n = this.n, step = f.blockAlign, bytes = f.bits / 8;
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const [s0, s1, s2, sa1, sa2] = this.c1, [h0, h1, h2, ha1, ha2] = this.c2;
    const bq = this.bq, [p1, p2, p3] = PHASES, clip = this.clipLevel;
    for (let o = 0; o < len; o += step) {
      let loud = false, l = 0, r = 0;
      for (let c = 0; c < n; c++) {
        const at = o + c * bytes;
        let x: number;
        if (f.codec === "float") x = bytes === 4 ? v.getFloat32(at, true) : v.getFloat64(at, true);
        else if (bytes === 3) x = ((b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)) << 8 >> 8) / 8388608;
        else if (bytes === 2) x = v.getInt16(at, true) / 32768;
        else if (bytes === 4) x = v.getInt32(at, true) / 2147483648;
        else x = (b[at] - 128) / 128;
        if (c === 0) l = x; else r = x;

        const a = x < 0 ? -x : x;
        this.sum[c] += x;
        if (a > this.peak) this.peak = a;
        if (a > 0.001) loud = true;
        if (a >= clip) { if (++this.run[c] === 3) this.clipRuns++; } else this.run[c] = 0;

        // true peak: three interpolated points between this sample and the previous one
        const ring = this.ring[c], pos = this.ringPos;
        ring[pos] = x; ring[pos + TAPS] = x;
        let y1 = 0, y2 = 0, y3 = 0;
        for (let j = 0, q = pos + 1; j < TAPS; j++, q++) { const w = ring[q]; y1 += p1[j] * w; y2 += p2[j] * w; y3 += p3[j] * w; }
        if (y1 < 0) y1 = -y1; if (y2 < 0) y2 = -y2; if (y3 < 0) y3 = -y3;
        const m = Math.max(a, y1, y2, y3);
        if (m > this.tp) this.tp = m;

        // K-weighting → energy
        const i = c * 4;
        const y = s0 * x + bq[i]; bq[i] = s1 * x - sa1 * y + bq[i + 1]; bq[i + 1] = s2 * x - sa2 * y;
        const z = h0 * y + bq[i + 2]; bq[i + 2] = h1 * y - ha1 * z + bq[i + 3]; bq[i + 3] = h2 * y - ha2 * z;
        this.subAcc += z * z;
      }
      this.ringPos = (this.ringPos + 1) % TAPS;
      if (n === 2) { this.sLR += l * r; this.sLL += l * l; this.sRR += r * r; }
      if (loud) { if (this.firstLoud < 0) this.firstLoud = this.frames; this.lastLoud = this.frames; }
      this.frames++;
      if (++this.subFill === this.subLen) { this.sub.push(this.subAcc / this.subLen); this.subAcc = 0; this.subFill = 0; }
    }
  }

  /** Gated loudness over windows of `span` 100 ms slices. */
  private windows(span: number): number[] {
    const out: number[] = [];
    let acc = 0;
    for (let i = 0; i < this.sub.length; i++) {
      acc += this.sub[i];
      if (i >= span) acc -= this.sub[i - span];
      if (i >= span - 1) out.push(acc / span);
    }
    return out;
  }

  finish(): WavMetrics {
    const f = this.fmt;
    if (!f || this.head) throw new NotWavError(this.head && this.head.length >= 12 ? sniff(this.head) : "an empty file");
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    let integrated: number | null = null;
    const blocks = this.windows(4).filter((e) => e > 0 && lufs(e) > -70);
    if (blocks.length) {
      const gate = lufs(mean(blocks)) - 10;
      const kept = blocks.filter((e) => lufs(e) > gate);
      if (kept.length) integrated = lufs(mean(kept));
    }

    let lra: number | null = null;
    const short = this.windows(30).filter((e) => e > 0 && lufs(e) > -70);
    if (short.length) {
      const gate = lufs(mean(short)) - 20;
      const l = short.map(lufs).filter((x) => x > gate).sort((a, b) => a - b);
      if (l.length) lra = l[Math.round(0.95 * (l.length - 1))] - l[Math.round(0.1 * (l.length - 1))];
    }

    const frames = this.frames || 1;
    const corr = this.n === 2 && this.sLL > 0 && this.sRR > 0 ? this.sLR / Math.sqrt(this.sLL * this.sRR) : null;
    return {
      container: "wav",
      codec: f.codec,
      channels: f.channels,
      sample_rate: f.rate,
      bit_depth: f.bits,
      duration_s: round(this.frames / f.rate, 2)!,
      integrated_lufs: round(integrated, 1),
      loudness_range_lu: round(lra, 1),
      true_peak_dbtp: round(db(this.tp), 2),
      sample_peak_dbfs: round(db(this.peak), 2),
      clip_runs: this.clipRuns,
      phase_correlation: round(corr, 2),
      dc_offset_pct: round(Math.max(...this.sum.slice(0, this.n).map((s) => Math.abs(s / frames))) * 100, 3)!,
      head_silence_s: round(this.firstLoud < 0 ? this.frames / f.rate : this.firstLoud / f.rate, 2)!,
      tail_silence_s: round(this.firstLoud < 0 ? 0 : (this.frames - 1 - this.lastLoud) / f.rate, 2)!,
    };
  }
}

/** Measures a WAV arriving as a byte stream. */
export async function analyzeWav(stream: AsyncIterable<Uint8Array>): Promise<WavMetrics> {
  const a = new WavAnalyzer();
  for await (const chunk of stream) a.push(chunk);
  return a.finish();
}
