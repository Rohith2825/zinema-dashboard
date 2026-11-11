import { Suspense } from "react";
import Link from "next/link";
import { MobileTabs, Nav, NavLinks } from "@/components/nav";
import { NavProgress } from "@/components/nav-progress";
import { UserMenu } from "@/components/user-menu";
import { pageShort } from "@/components/ui";
import { getSession } from "@/lib/session";
import { TZ, roleLabel, shortName } from "@/lib/types";

function Logo({ width = 116 }: { width?: number }) {
  return (
    <Link href="/board" className="flex items-end gap-2" aria-label="Zinema OS home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/zinema-wordmark.png" alt="Zinema Music" width={width} height={Math.round(width * 0.24)} />
      <span className="text-xl font-black leading-none tracking-tight text-brand-500">OS</span>
    </Link>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>

      {/* Desktop: floating dark rail */}
      <aside className="sticky top-4 z-10 m-4 mr-0 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col rounded-[28px] bg-[#0b0b0d] text-neutral-200 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] md:flex">
        <div className="px-5 pb-6 pt-7"><Logo /></div>
        <div className="flex-1 overflow-y-auto px-3">
          <Suspense fallback={<NavLinks path="" />}>
            <NavWithCount />
          </Suspense>
        </div>
        <div className="p-3">
          <a href="mailto:info@zinema.music" className="block rounded-2xl bg-white/[0.05] p-3.5 text-xs text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/[0.08]">
            <span className="block font-medium text-neutral-100">Need a hand?</span>
            info@zinema.music
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: phone gets the logo, everyone gets the account chip */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[#0b0b0d] px-4 py-2.5 md:static md:bg-transparent md:px-10 md:pb-0 md:pt-7">
          <div className="md:hidden"><Logo width={92} /></div>
          <Suspense fallback={<span />}>
            <Today />
          </Suspense>
          <Suspense fallback={<span className="skel block h-11 w-11 !rounded-full max-md:opacity-20 md:w-40" />}>
            <Account />
          </Suspense>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-6">
          <div className="mx-auto max-w-[1500px]">{children}</div>
          {/* Each page shows its own skeleton; the access check overlays the page instead of blocking it. */}
          <Suspense fallback={null}>
            <AccessGate />
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}>
        <Tabs />
      </Suspense>
    </div>
  );
}

async function NavWithCount() {
  const s = await getSession();
  return <Nav unread={s.unread} />;
}
async function Tabs() {
  const s = await getSession();
  return <MobileTabs unread={s.unread} />;
}

async function Today() {
  const s = await getSession();
  const name = shortName(s.profile);
  const first = name === "—" ? (s.user.email ?? "there").split("@")[0] : name.split(" ")[0];
  const date = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <p className="hidden text-sm text-muted md:block">
      <span className="font-medium text-foreground">Hi {first}</span> · {date}
    </p>
  );
}

async function Account() {
  const s = await getSession();
  return (
    <div className="flex items-center gap-2.5">
      <Link href="/inbox" className="tile relative flex h-11 w-11 items-center justify-center !rounded-full text-zinc-700" aria-label={`Inbox${s.unread ? `, ${s.unread} unread` : ""}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 004 0" />
        </svg>
        {s.unread > 0 && <span className="absolute right-0 top-0 min-w-4 rounded-full bg-brand-500 px-1 text-center text-[10px] font-bold text-black">{s.unread}</span>}
      </Link>
      <UserMenu
        me={{
          name: shortName(s.profile) === "—" ? (s.user.email ?? "You") : shortName(s.profile),
          email: s.profile?.email ?? s.user.email ?? "",
          photo: s.photo,
          role: s.level ? roleLabel(s.level) : "No access yet",
          handle: s.profile?.handle ?? null,
          pages: s.isAdmin || s.allRole
            ? [{ name: "All pages", role: roleLabel(s.level) }]
            : s.memberships.map((m) => ({ name: pageShort(s.pages.find((p) => p.id === m.page_id)?.name), role: roleLabel(m.role) })),
        }}
      />
    </div>
  );
}

async function AccessGate() {
  const s = await getSession();
  if (s.hasAccess) return null;
  return (
    <div className="fixed inset-0 top-14 z-10 flex items-start justify-center bg-background/90 px-4 backdrop-blur-md md:left-64 md:top-20">
      <div className="card mx-auto mt-16 max-w-md p-8 text-center">
        <span className="eq-loader mx-auto mb-4" aria-hidden="true"><i /><i /><i /><i /></span>
        <h2 className="text-lg font-semibold">You&apos;re in — almost</h2>
        <p className="mt-2 text-sm text-muted">
          {s.user.email} is signed in but isn&apos;t on a page yet. Ask a Zinema admin to add you, or write to{" "}
          <a href="mailto:info@zinema.music" className="font-medium text-brand-700 underline">info@zinema.music</a>.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <form action="/auth/signout" method="post">
            <button className="btn-dark">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
