import type { Metadata } from "next";
import { Crimson_Pro, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "openworship — Every word lands.",
  description:
    "Free, AI-powered worship display. Detects scripture and lyrics in real time. No manual lookup. No expensive licenses. Built for every church, everywhere.",
  openGraph: {
    title: "openworship — Every word lands.",
    description:
      "Free, AI-powered worship display. Detects scripture and lyrics in real time. No manual lookup. No expensive licenses.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "openworship — Every word lands.",
    description:
      "Free, AI-powered worship display. Detects scripture and lyrics in real time.",
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
      className={`${crimsonPro.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ow-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
