import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: true, follow: false },
  alternates: { canonical: "/login" },
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-neutral-100">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zinema-wordmark.svg" alt="zinema" width={156} height={38} />
          <h1 className="mt-4 text-lg font-semibold">Zinema OS</h1>
          <p className="mt-1 text-sm text-neutral-400">Sign in with your Google account.</p>
        </div>
        <Suspense fallback={<GoogleButton />}>
          <LoginForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  return (
    <>
      {error && <p className="mb-4 rounded bg-red-950 p-3 text-sm text-red-300">Sign-in failed. Please try again.</p>}
      <GoogleButton next={typeof next === "string" ? next : undefined} />
    </>
  );
}
