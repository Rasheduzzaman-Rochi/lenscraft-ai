import type { Metadata, Viewport } from "next";

import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { VoiceAssistant } from "@/components/voice-assistant";

export const metadata: Metadata = {
  metadataBase: new URL("https://lenscraft.studio"),
  title: {
    default: "LensCraft Studio — Commercial Photography",
    template: "%s — LensCraft Studio",
  },
  description: "Premium product, fashion, jewellery, and lifestyle photography for ambitious brands.",
  openGraph: {
    title: "LensCraft Studio",
    description: "Commercial photography, considered.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F3",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="sr-only z-[100] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
        <VoiceAssistant />
      </body>
    </html>
  );
}
