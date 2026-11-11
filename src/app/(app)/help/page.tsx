import type { Metadata } from "next";
import { GuideContent } from "@/components/guide-content";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Guide" };

/** The guidebook inside the dashboard, so reading it never takes you out of your workspace. */
export default function HelpPage() {
  return (
    <>
      <PageTitle
        title="Guide"
        sub={<>How Zinema OS works, start to finish. Stuck? Write to <a href="mailto:info@zinema.music" className="font-medium text-brand-700 underline">info@zinema.music</a>.</>}
      />
      <GuideContent stickyTop="lg:top-8" />
    </>
  );
}
