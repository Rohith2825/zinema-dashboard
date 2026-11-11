import type { Metadata } from "next";
import { LegalPage, Mail } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using Zinema OS, the private workspace of Zinema Music.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      updated="12 November 2026"
      intro={<p>Zinema OS is a private workspace run by Zinema Music. By signing in you agree to the points below. They are written to be read; if anything is unclear, ask <Mail />.</p>}
      sections={[
        ["Access is by invitation", <p key="a">You may use Zinema OS only with the Google account that was given access, and only at the level you were given. Access can be changed or removed at any time. Don&apos;t share your account, sign-in or personal AI tokens with anyone else.</p>],
        ["Keep it confidential", <p key="b">Unreleased songs, lyrics, masters, artwork, release plans, credits and commercial terms are confidential. Don&apos;t copy them out of Zinema OS or Google Drive, or share them outside the team, unless that is part of your job on that release.</p>],
        ["Who owns the work", <p key="c">Being able to see or upload a file here doesn&apos;t change who owns it. Songs marked Zinema Original are owned by Zinema Music. Songs marked Community remain owned by their artist or label, on the terms agreed in writing for that song.</p>],
        ["Use it honestly", (
          <ul key="d">
            <li>Submit your own work and review other people&apos;s fairly. You can&apos;t check your own submission.</li>
            <li>Mark attendance only for yourself, from where you actually are.</li>
            <li>Don&apos;t try to get around access controls, or to access data you weren&apos;t given.</li>
          </ul>
        )],
        ["Connected AI assistants", <p key="e">If you connect an assistant such as Claude or ChatGPT, it acts as you. You are responsible for what it does with your access, and its actions are logged under your name. Your use of the assistant itself is covered by that provider&apos;s own terms.</p>],
        ["Third-party services", <p key="f">Zinema OS relies on Google (sign-in and Drive), Supabase, Vercel and Spotify. Their availability and terms are outside our control.</p>],
        ["No warranty", <p key="g">Zinema OS is an internal tool provided as it is. We work to keep it accurate and available, but it may change, pause or contain mistakes, and it is not a substitute for the signed agreements that govern a release.</p>],
        ["Contact", <p key="h">Questions about these terms, or about your access, go to <Mail />.</p>],
      ]}
    />
  );
}
