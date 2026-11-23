import { inflateRawSync } from "node:zlib";

/** Pulls the plain text out of a .docx (a zip holding word/document.xml) without extra libraries. */
export function docxText(file: Buffer): string {
  // The zip's index sits at the end of the file.
  let eocd = -1;
  for (let i = file.length - 22; i >= Math.max(0, file.length - 66000); i--) if (file.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("That Word file couldn't be opened.");
  let o = file.readUInt32LE(eocd + 16);
  for (let left = file.readUInt16LE(eocd + 10); left > 0 && file.readUInt32LE(o) === 0x02014b50; left--) {
    const method = file.readUInt16LE(o + 10), size = file.readUInt32LE(o + 20);
    const nameLen = file.readUInt16LE(o + 28), extraLen = file.readUInt16LE(o + 30), commentLen = file.readUInt16LE(o + 32), local = file.readUInt32LE(o + 42);
    if (file.toString("utf8", o + 46, o + 46 + nameLen) === "word/document.xml") {
      const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28);
      const raw = file.subarray(start, start + size);
      const xml = (method === 0 ? raw : inflateRawSync(raw)).toString("utf8");
      return xml
        .replace(/<w:(br|cr)[^>]*\/>/g, "\n").replace(/<w:tab[^>]*\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
    }
    o += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("That Word file has no text in it.");
}

export type LyricStats = { lines: number; sections: number; words: number; unique_line_pct: number; most_repeated_line: string | null; repeats: number; hook_first_at_pct: number | null };

/** Counting only: how long the lyric is, how much it repeats, and where the most-repeated line first shows up. */
export function lyricStats(text: string): LyricStats {
  const isLabel = (l: string) => /^[\[(].{0,40}[\])]$/.test(l) || /^(pallavi|charanam|anupallavi|chorus|pre-chorus|verse|bridge|hook|intro|outro|mukhda|antara)\s*\d*\s*[:\-]?$/i.test(l);
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter((l) => l && !isLabel(l))).filter((b) => b.length);
  const lines = blocks.flat();
  const key = (l: string) => l.toLowerCase().replace(/[\p{P}\p{S}]/gu, "").replace(/\s+/g, " ").trim();
  const count = new Map<string, number>();
  lines.forEach((l) => count.set(key(l), (count.get(key(l)) ?? 0) + 1));
  const [top, repeats] = [...count.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const first = lines.findIndex((l) => key(l) === top);
  return {
    lines: lines.length,
    sections: blocks.length,
    words: lines.join(" ").split(/\s+/).filter(Boolean).length,
    unique_line_pct: lines.length ? Math.round((count.size / lines.length) * 100) : 0,
    most_repeated_line: repeats > 1 ? lines[first] : null,
    repeats: repeats > 1 ? repeats : 0,
    hook_first_at_pct: repeats > 1 && lines.length > 1 ? Math.round((first / (lines.length - 1)) * 100) : null,
  };
}
