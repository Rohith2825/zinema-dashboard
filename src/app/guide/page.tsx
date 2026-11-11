import type { Metadata } from "next";
import { GuideContent } from "@/components/guide-content";
import { PublicFooter, PublicHeader } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Guide",
  description: "How to get into Zinema OS, what each role does, how a song moves from lyrics to live, and how to connect your own AI.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/guide" },
};

export default function Guide() {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <div className="mx-auto mt-14 w-[min(1120px,calc(100%-2rem))]">
        <p className="eyebrow">Guidebook</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-6xl">How Zinema OS works</h1>
        <p className="mt-4 max-w-2xl text-muted">Ten minutes, start to finish. If anything here doesn&apos;t match what you see, write to <a href="mailto:info@zinema.music" className="font-medium text-brand-700 underline">info@zinema.music</a>.</p>
        <div className="mt-12"><GuideContent /></div>
      </div>
      <PublicFooter />
    </div>
  );
}
