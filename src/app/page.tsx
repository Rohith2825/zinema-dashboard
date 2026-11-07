import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";

type Membership = { role: string; pages: { name: string; slug: string } | null };

export default function Home() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-neutral-500">Loading…</main>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, is_org_admin")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("page_members")
    .select("role, pages(name, slug)")
    .eq("user_id", user?.id ?? "")
    .returns<Membership[]>();

  const hasAccess = profile?.is_org_admin || (memberships?.length ?? 0) > 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Zinema OS</h1>
          <p className="text-sm text-neutral-500">
            {profile?.full_name ?? user?.email}
            {profile?.is_org_admin ? " · Admin" : ""}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-neutral-500 underline">Sign out</button>
        </form>
      </header>

      {!hasAccess ? (
        <section className="mt-10 rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <h2 className="font-medium">You&apos;re signed in, but not on any page yet</h2>
          <p className="mt-1 text-sm">Ask a Zinema admin to add {user?.email} to a page (Tamil, Hindi, Marathi, Spiritual or Indie).</p>
        </section>
      ) : (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Your pages</h2>
          <ul className="mt-3 divide-y rounded-xl border">
            {(memberships ?? []).map((m) => (
              <li key={`${m.pages?.slug}-${m.role}`} className="flex justify-between px-4 py-3">
                <span>{m.pages?.name}</span>
                <span className="text-sm text-neutral-500">{m.role}</span>
              </li>
            ))}
            {profile?.is_org_admin && (memberships?.length ?? 0) === 0 && (
              <li className="px-4 py-3 text-sm text-neutral-500">Admin: all pages</li>
            )}
          </ul>
          <p className="mt-6 text-sm text-neutral-500">Kanban and Calendar views are next.</p>
        </section>
      )}
    </main>
  );
}
