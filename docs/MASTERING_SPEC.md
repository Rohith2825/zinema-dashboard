# Zinema Mastering & Delivery Spec (v0.1)

These are the default thresholds the **mix-audit** skill checks before a master goes to PDL. They are stored in `audit_thresholds` per page, so they can be changed later without code changes.

## Why one master works for every platform
Streaming services turn loud tracks down to their own target, and most of them do not turn quiet tracks up much. Making a separate master per platform is not needed. Make **one** master that:
1. is not so loud that every service turns it down and flattens its punch, and
2. keeps enough true-peak headroom that the lossy versions (AAC/Ogg/MP3) don't distort.

## What each platform does (as published / widely reported, Nov 2026)

| Platform | Normalises to | True-peak advice | Notes |
|---|---|---|---|
| Spotify | −14 LUFS (Loud −11, Quiet −19) | ≤ −1 dBTP; **≤ −2 dBTP if master is louder than −14 LUFS** | Official Spotify for Artists guidance |
| Apple Music | ≈ −16 LUFS (Sound Check) | ≤ −1 dBTP | Apple Digital Masters prefers 24-bit hi-res source |
| YouTube / YT Music | ≈ −14 LUFS (turns down only) | ≤ −1 dBTP | Also applies to lyric/visualizer/MV uploads |
| Amazon Music | ≈ −14 LUFS | ≤ −2 dBTP reported | |
| Tidal | −14 LUFS (album mode, down only) | ≤ −1 dBTP | |
| Deezer | ≈ −15 LUFS | ≤ −1 dBTP | |
| JioSaavn / Gaana / Wynk | No public spec | Use the same master | Very important in India; we just follow the safe master |
| Instagram Reels / YT Shorts | No public spec; −14 LUFS is the usual working target | ≤ −1 dBTP | For the audio inside promo verticals |

Apple's and Amazon's numbers come from secondary sources. Check them again once a year; the thresholds table makes that a config change.

## Zinema defaults (mix-audit)

| Check | Pass | Warn | Fail |
|---|---|---|---|
| File format | WAV (PCM), stereo | — | MP3/AAC, mono, or a wrong container |
| Bit depth | 24-bit | 16-bit (OK for PDL, but we lose the hi-res badge) | < 16-bit |
| Sample rate | 44.1 or 48 kHz (or higher) | — | < 44.1 kHz |
| Integrated loudness, **standard pages** (Tamil, Hindi, Marathi, Indie) | −14 to −9 LUFS | −9 to −7 (will be turned down ~5 dB+, sounds squashed) or −16 to −14 | Louder than −7 or quieter than −16 |
| Integrated loudness, **Spiritual** | −16 to −12 LUFS | −12 to −10 or −18 to −16 | Louder than −10 or quieter than −18 |
| True peak | ≤ −1.0 dBTP (if ≤ −14 LUFS); ≤ −2.0 dBTP (if louder than −14 LUFS) | −2.0 to −1.0 dBTP on a loud master | > −1.0 dBTP |
| Clipping | 0 runs of ≥ 3 consecutive full-scale samples | 1–3 runs | > 3 runs |
| Loudness range (LRA) | ≥ 4 LU (standard), ≥ 6 LU (Spiritual) | below that | — |
| Phase correlation (average) | > +0.3 | 0 to +0.3 | < 0 (mono collapse risk) |
| DC offset | < 0.1 % | 0.1–0.5 % | > 0.5 % |
| Head silence | ≤ 0.5 s | 0.5–2 s | > 2 s |
| Tail silence | ≤ 3 s | 3–6 s | > 6 s |
| Duration | Matches song metadata ±1 s | — | Mismatch (wrong file) |

Indian film and pop masters are commonly around −9 to −8 LUFS. That is allowed with a warning, not blocked: it is a creative choice, but the report tells the engineer how many dB each platform will turn it down.

## Artwork (artwork-audit)
- 3000 × 3000 px, square, JPG or PNG, RGB, no transparency, < 10 MB.
- No URLs, social handles, prices, "new"/"exclusive" text or other-platform logos. DSPs reject these.
- Title/artist text on the cover must match the metadata.

## Still to confirm with PDL
Take PDL's exact upload limits (bit depth, sample rate, file size, artwork rules) from the Cosmos upload form and lock them in as the hard **fail** limits above.

## Sources
- [Spotify for Artists: Loudness normalization](https://support.spotify.com/artists/article/loudness-normalization/)
- [gearnews: Loudness war](https://www.gearnews.com/loudness-war/)
- [MasteringBOX: Mastering for streaming](https://www.masteringbox.com/learn/mastering-for-streaming)
- [Streaming platform loudness standards (2026 guide)](https://dj-master-web.vercel.app/en/blog/streaming-loudness-standards-en)
- [SoundBridge: Mastering for streaming, 2026](https://www.soundbridge.io/mastering-for-streaming-your-2026-platform-guide)
