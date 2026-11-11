import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/site";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Zinema OS — the song pipeline, approvals and release calendar for Zinema Music: Tamil, Hindi, Marathi, Spiritual and Community.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Zinema OS", template: "%s · Zinema OS" },
  description: DESCRIPTION,
  applicationName: "Zinema OS",
  openGraph: { type: "website", siteName: "Zinema Music", title: "Zinema OS", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "Zinema OS", description: DESCRIPTION },
  // Private workspace: only /login is indexable (set on that page).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
