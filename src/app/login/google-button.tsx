"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function GoogleButton({ next }: { next?: string }) {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
    });
  }

  return (
    <button
      onClick={signIn}
      disabled={busy}
      className="w-full rounded-lg bg-white px-4 py-3 font-medium text-neutral-900 shadow ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-60"
    >
      {busy ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}
