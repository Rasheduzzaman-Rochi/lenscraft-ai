"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { VoiceAssistant } from "@/components/voice-assistant";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
      <VoiceAssistant />
    </>
  );
}
