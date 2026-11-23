import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * The judgement half of the audits. Numbers are measured in code elsewhere; Claude only gives an
 * opinion on things code can't measure (is there a web address on the cover, is the hook strong).
 * Needs ANTHROPIC_API_KEY; without it the measured checks still run and these are skipped.
 */

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = "claude-opus-5-5";

export class AiError extends Error {}

let client: Anthropic | null = null;

async function ask<T extends z.ZodType>(schema: T, system: string, content: Anthropic.Beta.BetaContentBlockParam[]): Promise<z.infer<T>> {
  if (!aiConfigured()) throw new AiError("The AI reviewer isn't switched on yet. An admin needs to add ANTHROPIC_API_KEY. Until then, ask Claude or ChatGPT through Connect to do this review.");
  client ??= new Anthropic();
  try {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // If the model declines a request, the API retries it on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
      output_config: { format: betaZodOutputFormat(schema) },
    });
    if (res.stop_reason === "refusal") throw new AiError("The AI reviewer declined to review this file.");
    if (res.stop_reason === "max_tokens" || !res.parsed_output) throw new AiError("The AI reviewer's answer was cut short. Try again.");
    return res.parsed_output;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("The AI reviewer's key was rejected. An admin needs to check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.RateLimitError) throw new AiError("The AI reviewer is busy right now. Try again in a minute.");
    if (e instanceof Anthropic.APIError) throw new AiError(`The AI reviewer couldn't finish (${e.status ?? "network"}). Try again.`);
    throw e;
  }
}

export type SongContext = {
  code: string; title: string; page: string; language: string | null; artists?: string | null;
  credits?: { role: string; name: string }[]; isrc?: string | null; release_date?: string | null;
  mood?: string | null; spotify_url?: string | null;
};
const about = (s: SongContext) =>
  [
    `Song: "${s.title}" (${s.code})`,
    `Label page: ${s.page}${s.language ? `, language: ${s.language}` : ""}`,
    s.artists && `Artists: ${s.artists}`,
    s.credits?.length && `Credits: ${s.credits.map((c) => `${c.role}: ${c.name}`).join("; ")}`,
    s.isrc && `ISRC: ${s.isrc}`,
    s.release_date && `Release date: ${s.release_date}`,
    s.mood && `Mood / brief: ${s.mood}`,
    s.spotify_url && `Spotify: ${s.spotify_url}`,
  ].filter(Boolean).join("\n");

const LABEL = "Zinema Music is an Indian music label releasing Tamil, Hindi, Marathi, Spiritual and Community songs to streaming stores (Spotify, Apple Music, YouTube Music, JioSaavn) and promoting them on Instagram, YouTube and X.";
const PLAIN = "Write for a busy teammate who is not a native English speaker: short plain sentences, no jargon, no idioms. Be specific about this file, not generic.";

// ───────────── Artwork ─────────────
const Level = z.enum(["pass", "warn", "fail"]);
const ArtworkReview = z.object({
  store_rules: z.object({ status: Level, found: z.string().describe("What on the cover could make a store reject it, or 'Nothing found'."), fix: z.string().describe("What to change. Empty when status is pass.") }),
  text_matches_song: z.object({ status: Level, found: z.string().describe("The title/artist text you can read on the cover, or 'No text on the cover'."), fix: z.string() }),
  thumbnail: z.object({ status: Level, found: z.string().describe("How it reads at the small size shown in a playlist."), fix: z.string() }),
  image_quality: z.object({ status: Level, found: z.string().describe("Blur, pixelation, stretching, compression marks, awkward crop."), fix: z.string() }),
  summary: z.string().describe("Two or three sentences: is this cover ready, and the one most useful improvement."),
});
export type ArtworkReview = z.infer<typeof ArtworkReview>;

export function reviewArtwork(jpeg: Buffer, song: SongContext) {
  return ask(
    ArtworkReview,
    `${LABEL} You check cover art before it is sent to the distributor. ${PLAIN}

Stores reject covers that carry: web addresses, social handles, email or phone numbers, prices, store or platform logos, QR codes, words like "new", "exclusive", "out now", "available on", or text that doesn't match the release's title and artist. Mark store_rules "fail" only for something a store would actually reject, "warn" for something borderline.
For text_matches_song, compare any title or artist text on the cover with the song details given. Different script or a stylised spelling of the same name is fine. No text at all is a pass.
For thumbnail, judge the smaller copy of the image: can you still tell what it is and read the title.
You are advising a person who makes the final call, so say what you see.`,
    [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
      { type: "text", text: `${about(song)}\n\nThe image above is the cover, scaled down for viewing. Its real pixel size, colour mode and file size are checked separately, so don't comment on those.` },
    ],
  );
}

// ───────────── Carousel ─────────────
const Point = z.object({ status: Level, found: z.string(), fix: z.string().describe("What to change. Empty when status is pass.") });
const CarouselReview = z.object({
  first_slide: Point.describe("Would the first slide make someone stop scrolling and swipe?"),
  story: Point.describe("Do the slides follow on from one another, each giving a reason to swipe again?"),
  readability: Point.describe("Is the text big, short and high-contrast enough to read on a phone? Name the slide numbers that fail."),
  mistakes: Point.describe("Spelling mistakes, wrong names, text cut off at the edges. Quote them with the slide number. 'Nothing found' if clean."),
  last_slide: Point.describe("Does the last slide tell people what to do (listen, save, share, follow)?"),
  consistency: Point.describe("Same fonts, colours and style across slides, and it looks like the label's other posts."),
  summary: z.string().describe("Two or three sentences: is it ready to post, and the one most useful improvement."),
});
export type CarouselReview = z.infer<typeof CarouselReview>;

export function reviewCarousel(slides: Buffer[], song: SongContext) {
  return ask(
    CarouselReview,
    `${LABEL} You check an Instagram carousel for a song before it is posted. ${PLAIN}

The images are the slides in posting order; refer to them as "slide 1", "slide 2". Compare any song title, artist name or lyric on the slides with the song details given, and report differences as mistakes (a different script or a stylised spelling of the same name is fine). Use "fail" only for something that should not be posted as it is, such as a wrong name or unreadable text; "warn" for things worth improving.
You are advising the designer and the person who checks the post; they decide.`,
    [
      ...slides.map((b): Anthropic.Beta.BetaContentBlockParam => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b.toString("base64") } })),
      { type: "text", text: `${about(song)}\n\nAbove: ${slides.length} slide${slides.length === 1 ? "" : "s"}, scaled down. Pixel sizes are checked separately, so don't comment on those.` },
    ],
  );
}

// ───────────── Video (one preview frame) ─────────────
const FrameReview = z.object({
  text_safe_zone: Point.describe("For an upright video: is any text or face inside the top 12% or bottom 25% of the frame, where the app's buttons and caption cover it? For a wide video: is text too close to the edges?"),
  readability: Point.describe("Can the on-screen text be read on a phone? 'No text in this frame' is a pass."),
  mistakes: Point.describe("Spelling mistakes or wrong names in on-screen text, compared with the song details and lyric. Quote them. 'Nothing found' if clean."),
  picture: Point.describe("Blur, pixelation, stretching, black bars, a watermark from an editing app or another platform's logo."),
  summary: z.string().describe("One or two sentences about this frame."),
});
export type FrameReview = z.infer<typeof FrameReview>;

export function reviewVideoFrame(frame: Buffer, song: SongContext, o: { vertical: boolean; lyrics?: string | null }) {
  return ask(
    FrameReview,
    `${LABEL} You look at one preview frame from a ${o.vertical ? "short upright video (reel / short)" : "wide video (lyric video, visualizer or music video)"} for a song, before a person checks the whole video. ${PLAIN}

You can see only this one frame, so judge only what is in it and never guess about the rest of the video, its pacing or its sound. A watermark from an editing app or another platform's logo is a "fail" (the apps hide such videos); other problems are usually "warn".`,
    [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame.toString("base64") } },
      { type: "text", text: `${about(song)}${o.lyrics ? `\n\n<lyric>\n${o.lyrics}\n</lyric>` : ""}\n\nThe image above is one preview frame of the video, scaled down.` },
    ],
  );
}

// ───────────── Lyrics ─────────────
const Score = z.number().describe("Whole number from 1 (weak) to 10 (excellent).");
const LyricReview = z.object({
  language: z.string().describe("Language(s) the lyric is written in."),
  hook: z.object({ score: Score, line: z.string().describe("The line most likely to stick, quoted from the lyric."), note: z.string() }),
  singability: z.object({ score: Score, note: z.string().describe("Rhythm, breath, awkward syllable clusters, lines that are hard to sing.") }),
  wordplay: z.object({ score: Score, note: z.string() }),
  short_video_fit: z.object({ score: Score, best_15_seconds: z.string().describe("The 2–4 lines that would work best as a reel or short, quoted."), note: z.string() }),
  sensitivity: z.object({ status: Level, note: z.string().describe("Anything that could offend on religion, caste, region, gender or politics, explicit words, or lines very close to a well-known existing song. 'Nothing found' if clean.") }),
  alternative_hooks: z.array(z.string()).describe("Two or three alternative hook lines in the lyric's own language and script."),
  suggestions: z.array(z.string()).describe("Up to five concrete changes, most useful first. Quote the line each one is about."),
  summary: z.string().describe("Two or three sentences for the lyricist."),
});
export type LyricReview = z.infer<typeof LyricReview>;

export function reviewLyrics(lyrics: { text: string } | { pdf: Buffer }, song: SongContext, stats?: object) {
  const body: Anthropic.Beta.BetaContentBlockParam[] = "pdf" in lyrics
    ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: lyrics.pdf.toString("base64") } }, { type: "text", text: `${about(song)}\n\nThe attached PDF is the lyric.` }]
    : [{ type: "text", text: `${about(song)}${stats ? `\n\nCounts measured by code: ${JSON.stringify(stats)}` : ""}\n\n<lyric>\n${lyrics.text}\n</lyric>` }];
  return ask(
    LyricReview,
    `${LABEL} You review a song lyric before music is made for it, as an experienced A&R person who knows Indian film and independent music in this language. ${PLAIN}

Judge the lyric as it will be heard, not as poetry on a page: does the hook land within the first lines of the chorus, can it be sung comfortably, would a 15-second cut make someone replay it. Write your notes in English, but quote lyric lines exactly as written and write alternative hook lines in the lyric's own language and script.
Scores should be honest: most working lyrics are 5–7, and 9–10 is rare. On a Spiritual page, judge devotion and clarity rather than trendiness, and be careful about anything that could be seen as disrespectful.
You are advising the lyricist and the person who approves the lyric; they decide.`,
    body,
  );
}

// ───────────── Captions ─────────────
const Captions = z.object({
  instagram: z.object({ caption: z.string(), hashtags: z.array(z.string()).describe("8–12 hashtags without the # sign: a mix of song-specific, language/genre and broad ones.") }),
  youtube: z.object({ title: z.string().describe("Under 70 characters."), description: z.string().describe("Full description: one-line hook, credits block, where to listen, hashtags on the last line.") }),
  shorts: z.object({ title: z.string().describe("Under 60 characters."), description: z.string() }),
  x: z.object({ post: z.string().describe("Under 260 characters, including the link if one was given.") }),
  on_screen_hooks: z.array(z.string()).describe("Three short text overlays (under 8 words) for the first second of a reel."),
  romanised_instagram_caption: z.string().describe("The Instagram caption in Latin letters, if the caption uses another script; otherwise an empty string."),
});
export type Captions = z.infer<typeof Captions>;

export function writeCaptions(song: SongContext, o: { lyrics?: string | null; brief?: string | null; hashtags?: { tag: string; posts: number }[] }) {
  const research = o.hashtags?.length
    ? `\n\nHashtags found on Instagram just now, with how many posts each has:\n${o.hashtags.map((h) => `#${h.tag} (${h.posts.toLocaleString("en-US")} posts)`).join("\n")}\nChoose most of the Instagram hashtags from this list: two or three large ones (over 1 million posts) for reach and the rest mid-sized (10,000 to 500,000) where a new post can still be seen. Skip any that don't fit this song. You may add one or two tags for the song title and artist.`
    : "";
  return ask(
    Captions,
    `${LABEL} You write the social captions for a song. A person on the team will review them before anything is posted.

Write the way this page's audience talks: for a Tamil, Hindi or Marathi page, mix that language (in its own script) with easy English the way Indian music pages do; for Spiritual, keep it warm and respectful with no slang; for Community, friendly and inclusive. Lead with feeling or a lyric line, not with "New song out now".
Credits must be exact: use only the names, ISRC, date and links given below, spelled exactly as given. If something isn't given, leave it out rather than guess. Do not invent streaming numbers, quotes or awards.
Instagram: a first line that works before "…more", two or three short lines, then a call to action. YouTube: a searchable title in the pattern people search ("Song | Artist | Language Song"), and a description with the credits block. X: one punchy line.`,
    [{ type: "text", text: `${about(song)}${o.brief ? `\n\nWhat the team wants from these captions: ${o.brief}` : ""}${research}${o.lyrics ? `\n\n<lyric>\n${o.lyrics}\n</lyric>` : ""}` }],
  );
}
