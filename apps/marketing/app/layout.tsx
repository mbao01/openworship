import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { EB_Garamond } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "openworship — AI-powered worship display software",
  description:
    "Free, AI-powered worship display software. Detects scripture and lyrics in real time. No manual lookup. No expensive licenses.",
  openGraph: {
    title: "openworship — AI-powered worship display software",
    description:
      "Free, AI-powered worship display software. Detects scripture and lyrics in real time. No manual lookup. No expensive licenses.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${ebGaramond.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
