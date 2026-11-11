import Link from "next/link";

/** Shared header and footer for the public pages (landing, guide). */
export function PublicHeader() {
  return (
    <header className="sticky top-4 z-20 mx-auto flex w-[min(1120px,calc(100%-2rem))] items-center justify-between rounded-full bg-[#0b0b0d]/95 px-5 py-3 text-sm text-neutral-300 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur">
      <Link href="/" className="flex items-end gap-2" aria-label="Zinema OS">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/zinema-wordmark.png" alt="Zinema Music" width={100} height={24} />
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

export function PublicFooter() {
  return (
    <footer className="mx-auto mt-28 w-[min(1120px,calc(100%-2rem))] pb-12">
      <div className="card flex flex-wrap items-center justify-between gap-6 px-6 py-7 md:px-8">
        <div>
          <p className="text-sm font-semibold">Zinema Music · It Just Hits</p>
          <p className="mt-1 text-xs text-muted">Zinema OS is the private workspace of the Zinema Music team.</p>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <Link href="/login" className="text-zinc-600 hover:text-black">Sign in</Link>
          <a href="mailto:info@zinema.music" className="btn-ghost">info@zinema.music</a>
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
