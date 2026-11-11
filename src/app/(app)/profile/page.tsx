import { Suspense } from "react";
import type { Metadata } from "next";
import { updateProfile } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { FormSkeleton } from "@/components/skeletons";
import { Avatar, Badge, PageDot, PageTitle, pageShort } from "@/components/ui";
import { getSession } from "@/lib/session";
import { roleLabel, shortName } from "@/lib/types";

export const metadata: Metadata = { title: "Your profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<FormSkeleton label="Loading your profile" />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const s = await getSession();
  const p = s.profile;
  const pages = s.isAdmin || s.allRole ? null : s.memberships.map((m) => s.pages.find((x) => x.id === m.page_id)).filter(Boolean);
  return (
    <>
      <PageTitle title="Your profile" sub="How the team sees you. Your ID is what people type after @ to tag you in comments and tasks." />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Preview card */}
        <section className="card p-6 text-center">
          <div className="flex justify-center"><Avatar name={shortName(p)} email={p?.email} src={s.photo} size={88} /></div>
          <p className="mt-4 text-xl font-semibold">{shortName(p)}</p>
          <p className="text-sm text-brand-700">{p?.handle ? `@${p.handle}` : "no ID yet"}</p>
          {p?.bio && <p className="mt-3 text-sm text-zinc-700">{p.bio}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            <Badge tone="violet">{s.level ? roleLabel(s.level) : "No access yet"}</Badge>
            {pages === null ? <Badge>All pages</Badge> : pages.map((pg) => <Badge key={pg!.id}><PageDot prefix={pg!.code_prefix} className="mr-1" />{pageShort(pg!.name)}</Badge>)}
          </div>
          <p className="mt-5 border-t border-black/[0.06] pt-4 text-xs text-muted">Signed in with Google as<br /><span className="font-medium text-foreground">{p?.email ?? s.user.email}</span></p>
        </section>

        <section className="card p-5 md:p-7">
          <ActionForm action={updateProfile} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="nickname">Nickname</label>
                <input id="nickname" name="nickname" defaultValue={p?.nickname ?? ""} maxLength={40} placeholder={p?.full_name ?? "What people call you"} className="input" />
                <p className="mt-1.5 text-xs text-muted">Shown instead of your Google name ({p?.full_name}).</p>
              </div>
              <div>
                <label className="label" htmlFor="handle">Your ID</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
                  <input id="handle" name="handle" required defaultValue={p?.handle ?? ""} minLength={3} maxLength={30} pattern="[A-Za-z0-9._]{3,30}" autoCapitalize="none" spellCheck={false} className="input !pl-7 font-mono" />
                </div>
                <p className="mt-1.5 text-xs text-muted">3–30 letters, numbers, dots or underscores. Must be unique.</p>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="bio">About you</label>
              <textarea id="bio" name="bio" rows={4} maxLength={300} defaultValue={p?.bio ?? ""} placeholder="What you do at Zinema, what to come to you for…" className="input" />
              <p className="mt-1.5 text-xs text-muted">Up to 300 characters. Shown on your card on the Team page.</p>
            </div>
            <Submit>Save profile</Submit>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
