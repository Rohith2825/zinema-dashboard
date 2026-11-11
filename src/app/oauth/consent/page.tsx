import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Connect an app", robots: { index: false } };

/** Consent screen for Supabase's OAuth 2.1 server: shown when Claude (or another AI client) asks to connect. */
export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-4 py-10">
      <Suspense fallback={<div className="card w-full max-w-md p-8"><span className="eq-loader" aria-hidden="true"><i /><i /><i /><i /></span></div>}>
        <Consent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function decide(formData: FormData) {
  "use server";
  const id = String(formData.get("authorization_id"));
  const supabase = await createClient();
  const { data, error } =
    formData.get("decision") === "approve"
      ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data) redirect(`/oauth/consent?authorization_id=${encodeURIComponent(id)}&failed=1`);
  redirect(data.redirect_url);
}

async function Consent({ searchParams }: Pick<PageProps<"/oauth/consent">, "searchParams">) {
  const sp = await searchParams;
  const id = typeof sp.authorization_id === "string" ? sp.authorization_id : "";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const { data, error } = id ? await supabase.auth.oauth.getAuthorizationDetails(id) : { data: null, error: new Error("missing") };
  if (data && !("authorization_id" in data)) redirect(data.redirect_url); // already approved earlier

  if (error || !data) {
    return (
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">This connection request has expired</h1>
        <p className="mt-2 text-sm text-muted">Go back to your AI app and start connecting again. Still stuck? Write to <a className="font-medium text-brand-700 underline" href="mailto:info@zinema.music">info@zinema.music</a>.</p>
      </div>
    );
  }

  return (
    <div className="card w-full max-w-md p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0d0d10]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zinema-icon.png" alt="" width={44} height={44} className="rounded-2xl" />
        </span>
        <div>
          <p className="eyebrow">Zinema OS</p>
          <h1 className="text-xl font-semibold">Connect {data.client.name}?</h1>
        </div>
      </div>
      <p className="mt-5 text-sm text-muted">
        <b className="text-foreground">{data.client.name}</b> will be able to read and update Zinema OS as <b className="text-foreground">{auth.user.email}</b> — songs, files, formats, tasks and Drive folders — with the same page roles you have here.
      </p>
      <ul className="well mt-5 space-y-2 p-4 text-xs text-zinc-700">
        <li>✓ It can only do what you can do</li>
        <li>✓ Everything it does is logged as “via AI”</li>
        <li>✓ It can&apos;t approve your own submissions</li>
        <li className="text-muted">Sends you back to {new URL(data.redirect_uri).host}</li>
      </ul>
      {sp.failed && <p className="mt-3 text-xs text-red-600">That didn&apos;t go through. Try again.</p>}
      <form action={decide} className="mt-6 flex gap-3">
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        <button name="decision" value="deny" className="btn-ghost flex-1">Cancel</button>
        <button name="decision" value="approve" className="btn flex-1">Allow access</button>
      </form>
    </div>
  );
}
