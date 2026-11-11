import type { Metadata } from "next";
import { LegalPage, Mail } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Zinema OS collects about the people who use it, why, and how long it is kept.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="12 November 2026"
      intro={<p>Zinema OS is the private workspace Zinema Music uses to make and release songs. This page explains what it holds about the people who sign in, in plain language. Questions go to <Mail />.</p>}
      sections={[
        ["Who this covers", <p key="a">Team members, Community artists and partners who have been given access to Zinema OS. Visitors to the public pages are not tracked: there are no advertising or analytics cookies.</p>],
        ["What we collect", (
          <ul key="b">
            <li><b>Your Google account basics</b> when you sign in: name, email address and profile photo.</li>
            <li><b>Your profile</b>: the nickname, ID and description you choose to add.</li>
            <li><b>Your work</b>: files you submit, reviews, comments, tasks and an activity log of who did what and when.</li>
            <li><b>Attendance</b>, only if an owner has switched it on for you: the time, your location at that moment and a selfie.</li>
            <li><b>AI connections</b>: if you connect an assistant, the actions it takes on your behalf are logged as yours, marked “via AI”.</li>
          </ul>
        )],
        ["Why we collect it", <p key="c">To run the release pipeline: knowing who made, checked and approved each file; keeping a reliable record of releases; and, where attendance applies, confirming presence at an office. We do not sell personal data or use it for advertising.</p>],
        ["Who can see it", (
          <ul key="d">
            <li>Your name, ID, description and work are visible to the team members who share your pages.</li>
            <li>Royalty splits and contract terms are visible to rights owners only.</li>
            <li>Attendance records and selfies are visible to you and to owners only.</li>
          </ul>
        )],
        ["Where it is stored", <p key="e">Account and workflow data is held in a managed database (Supabase). Files and attendance selfies are held in Zinema Music&apos;s Google Drive. The site is hosted on Vercel. Sign-in is handled by Google. Catalogue details such as cover art and release dates come from Spotify&apos;s public listings.</p>],
        ["How long we keep it", (
          <ul key="f">
            <li>Attendance selfies are removed after the month they were taken in, plus five days. The time and location record is kept.</li>
            <li>Work records and the activity log are kept for as long as the song is part of the catalogue.</li>
            <li>When someone leaves, their access is removed; their past contributions stay attributed to them.</li>
          </ul>
        )],
        ["Your choices", <p key="g">You can edit your profile at any time. You can ask to see, correct or delete the personal data held about you, or to have your access removed, by writing to <Mail />. Location and camera access are requested by your browser only when you mark attendance, and you can refuse them.</p>],
        ["Changes", <p key="h">If this policy changes in a way that matters, the team will be told inside Zinema OS and the date above will be updated.</p>],
      ]}
    />
  );
}
