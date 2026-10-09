import type { Metadata } from "next";
import "./globals.css";
import "./attention/attention.css";
import "./collabcy.css";
import {SiteVisitTracker} from './attention/site-visits';

export const metadata: Metadata = {
  title: "CollabCy — Attention Marketplace",
  description: "Discover independent brands and claim a spotlight. CollabCy ranks products by paid bids.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/collabcy-mark.svg",
    shortcut: "/collabcy-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><SiteVisitTracker/>{children}</body>
    </html>
  );
}
