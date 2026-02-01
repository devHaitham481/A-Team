import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Syne } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Syne - geometric, modern, works well for ambigram-style logos
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "dip — Let AI dip into your workflow",
  description: "Record your screen. Paste to AI. It gets it. Stop explaining to AI, just show it what you mean.",
  keywords: ["screen recording", "AI", "workflow automation", "productivity", "macOS"],
  openGraph: {
    title: "dip — Stop explaining. Just show.",
    description: "Record your screen. Paste to AI. It gets it.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "dip — Stop explaining. Just show.",
    description: "Record your screen. Paste to AI. It gets it.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
