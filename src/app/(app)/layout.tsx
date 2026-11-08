import { Suspense } from "react";
import Link from "next/link";
import { Nav, NavLinks } from "@/components/nav";
import { getSession } from "@/lib/session";
import { shortName } from "@/lib/types";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b border-neutral-800 bg-black text-neutral-200 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r md:border-neutral-800">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:py-5">
          <Link href="/board" className="flex items-end gap-2" aria-label="Zinema OS home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/zinema-wordmark.png" alt="Zinema Music" width={112} height={27} />
            <span className="pb-0.5 text-xs font-semibold tracking-widest text-brand-500">OS</span>
          </Link>
        </div>
        <div className="overflow-x-auto px-2 pb-2 md:pb-0">
          <Suspense fallback={<NavLinks path="" />}>
            <NavWithCount />
          </Suspense>
        </div>
        <div className="hidden px-4 py-4 md:absolute md:bottom-0 md:block md:w-56">
          <Suspense fallback={null}>
            <UserBox />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <Gate>{children}</Gate>
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
    <div className="text-xs text-neutral-400">
      <p className="truncate font-medium text-neutral-100">{shortName(s.profile)}</p>
      <p className="truncate">
        {s.isAdmin ? "Admin" : "Member"}
        {s.isOwner ? " · Owner" : ""}
      </p>
      <form action="/auth/signout" method="post" className="mt-2">
        <button className="underline hover:text-white">Sign out</button>
      </form>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s.hasAccess) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
        <h2 className="font-medium">You&apos;re signed in, but not on any page yet</h2>
        <p className="mt-1 text-sm">Ask a Zinema admin to add {s.user.email} to Tamil, Hindi or Spiritual.</p>
        <form action="/auth/signout" method="post" className="mt-4">
          <button className="text-sm underline">Sign out</button>
        </form>
      </div>
    );
  }
  return <>{children}</>;
}
