import { Suspense } from "react";
import Link from "next/link";
import { Nav, NavLinks } from "@/components/nav";
import { NavProgress } from "@/components/nav-progress";
import { SidebarUserSkeleton } from "@/components/skeletons";
import { Avatar } from "@/components/ui";
import { getSession } from "@/lib/session";
import { shortName } from "@/lib/types";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>

      {/* Floating dark rail */}
      <aside className="z-10 bg-[#0b0b0d] text-neutral-200 md:sticky md:top-4 md:m-4 md:mr-0 md:flex md:h-[calc(100vh-2rem)] md:w-60 md:shrink-0 md:flex-col md:rounded-[28px] md:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]">
        <div className="px-5 pb-2 pt-4 md:pb-6 md:pt-7">
          <Link href="/board" className="flex items-end gap-2" aria-label="Zinema OS home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/zinema-wordmark.png" alt="Zinema Music" width={116} height={28} />
            <span className="pb-0.5 text-[10px] font-semibold tracking-[0.3em] text-brand-500">OS</span>
          </Link>
        </div>
        <div className="overflow-x-auto px-3 pb-3 md:flex-1 md:overflow-y-auto md:pb-0">
          <Suspense fallback={<NavLinks path="" />}>
            <NavWithCount />
          </Suspense>
        </div>
        <div className="hidden p-3 md:block">
          <Suspense fallback={<div className="rounded-2xl bg-white/[0.05] p-3"><SidebarUserSkeleton /></div>}>
            <UserBox />
          </Suspense>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-[1500px]">{children}</div>
        {/* Each page shows its own skeleton; the access check overlays the page instead of blocking it. */}
        <Suspense fallback={null}>
          <AccessGate />
        </Suspense>
      </main>
    </div>
  );
}

async function NavWithCount() {
  const s = await getSession();
  return <Nav unread={s.unread} />;
}

async function UserBox() {
  const s = await getSession();
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <Avatar name={s.profile?.full_name} email={s.profile?.email ?? s.user.email} size={34} ring={false} />
      <div className="min-w-0 flex-1 text-xs">
        <p className="truncate font-medium text-neutral-100">{shortName(s.profile)}</p>
        <p className="truncate text-neutral-500">
          {s.isAdmin ? "Admin" : "Member"}
          {s.isOwner ? " · Owner" : ""}
        </p>
      </div>
      <form action="/auth/signout" method="post">
        <button className="rounded-lg p-1.5 text-neutral-500 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h9" />
          </svg>
        </button>
      </form>
    </div>
  );
}

async function AccessGate() {
  const s = await getSession();
  if (s.hasAccess) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/90 px-4 backdrop-blur-md md:left-64">
      <div className="card mx-auto mt-28 max-w-md p-8 text-center">
        <span className="eq-loader mx-auto mb-4" aria-hidden="true"><i /><i /><i /><i /></span>
        <h2 className="text-lg font-semibold">You&apos;re in — almost</h2>
        <p className="mt-2 text-sm text-muted">
          {s.user.email} is signed in but isn&apos;t on a page yet. Ask a Zinema admin to add you, or write to{" "}
          <a href="mailto:info@zinema.music" className="font-medium text-brand-700 underline">info@zinema.music</a>.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/guide" className="btn-ghost">Read the guide</Link>
          <form action="/auth/signout" method="post">
            <button className="btn-dark">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
