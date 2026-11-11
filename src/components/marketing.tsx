import Link from "next/link";
import { BrandIcon, type Brand } from "@/components/landing/logos";

/** Shared header and footer for the public pages (landing, guide). */
export function PublicHeader() {
  return (
    <header className="sticky top-3 z-20 mx-auto flex w-[min(1120px,calc(100%-1.5rem))] items-center justify-between gap-3 rounded-full bg-[#0b0b0d]/95 py-2.5 pl-4 pr-2.5 sm:top-4 sm:px-5 sm:py-3 text-sm text-neutral-300 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur">
      <Link href="/" className="flex shrink-0 items-end gap-1.5 sm:gap-2" aria-label="Zinema OS">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/zinema-wordmark.png" alt="Zinema Music" width={100} height={24} className="h-auto w-[84px] sm:w-[100px]" />
        <span className="text-xl font-black leading-none tracking-tight text-brand-500">OS</span>
      </Link>
      <nav className="hidden items-center gap-7 md:flex">
        <Link href="/#platform" className="hover:text-white">Platform</Link>
        <Link href="/#ai" className="hover:text-white">Bring your AI</Link>
        <Link href="/#access" className="hover:text-white">Access</Link>
      </nav>
      <Link href="/board" className="btn !rounded-full !px-3.5 !py-1.5 text-xs sm:text-sm">Open <span className="hidden sm:inline">Zinema OS</span><span className="sm:hidden">app</span></Link>
    </header>
  );
}

const FOOT: { title: string; links: [string, string, boolean?][] }[] = [
  { title: "Zinema OS", links: [["The pipeline", "/#platform"], ["Bring your AI", "/#ai"], ["Access & pricing", "/#access"], ["Sign in", "/login"]] },
  { title: "Listen", links: [["Spotify", "https://open.spotify.com/artist/5zUwzGZwhIgnPZPNZyHcaw", true], ["YouTube", "https://www.youtube.com/@ZinemaMusicOfficial", true], ["Instagram", "https://www.instagram.com/zinema.music", true]] },
  { title: "Legal", links: [["Privacy policy", "/privacy"], ["Terms of use", "/terms"]] },
  { title: "Contact", links: [["info@zinema.music", "mailto:info@zinema.music"], ["Ask for access", "mailto:info@zinema.music?subject=Access%20to%20Zinema%20OS"], ["Partner with us", "mailto:info@zinema.music?subject=Partnering%20with%20Zinema%20Music"]] },
];

export function PublicFooter() {
  return (
    <footer className="mx-auto mt-24 w-[min(1120px,calc(100%-2rem))] pb-10 md:mt-32">
      <div className="card overflow-hidden !rounded-[32px] !shadow-raise-lg">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 p-6 md:grid-cols-[1.3fr_2fr] md:p-12">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/zinema-logo-ink.png" alt="Zinema Music — It Just Hits" width={220} height={81} className="h-auto w-44 md:w-52" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              Zinema OS is the private workspace of the Zinema Music team: every song, from first lyric to live.
            </p>
            <div className="mt-6 flex gap-3">
              {([["spotify", "https://open.spotify.com/artist/5zUwzGZwhIgnPZPNZyHcaw"], ["youtube", "https://www.youtube.com/@ZinemaMusicOfficial"], ["instagram", "https://www.instagram.com/zinema.music"]] as [Brand, string][]).map(([b, href]) => (
                <a key={b} href={href} target="_blank" rel="noreferrer" className="tile tile-hover flex h-11 w-11 items-center justify-center !rounded-2xl" aria-label={`Zinema Music on ${b}`}>
                  <BrandIcon name={b} size={20} />
                </a>
              ))}
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4" aria-label="Footer">
            {FOOT.map((col) => (
              <div key={col.title} className={`min-w-0 ${col.title === "Contact" ? "col-span-2 sm:col-span-1" : ""}`}>
                <p className="eyebrow">{col.title}</p>
                <ul className="mt-4 space-y-3 text-sm">
                  {col.links.map(([label, href, ext]) => (
                    <li key={label}>
                      {href.startsWith("/") ? (
                        <Link href={href} className="text-zinc-700 hover:text-brand-700">{label}</Link>
                      ) : (
                        <a href={href} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})} className="text-zinc-700 [overflow-wrap:anywhere] hover:text-brand-700">{label}{ext ? " ↗" : ""}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="well mx-4 mb-4 flex flex-col items-center gap-2 !rounded-2xl px-5 py-4 text-center text-xs text-muted sm:flex-row sm:justify-between md:mx-6 md:mb-6">
          <p>© 2026 Zinema Music. All rights reserved.</p>
          <p className="flex items-center gap-2"><span className="inline-block h-2 w-2 bg-brand-500" />It Just Hits</p>
        </div>
      </div>
    </footer>
  );
}

export function Eq({ bars = 40, className = "" }: { bars?: number; className?: string }) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        const r = (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1;
        return (
          <i
            key={i}
            className="mk-bar flex-1 rounded-t-sm"
            style={{ animationDuration: `${(0.45 + r * 0.7).toFixed(2)}s`, animationDelay: `${(-r * 1.3).toFixed(2)}s` }}
          />
        );
      })}
    </div>
  );
}
