import type { Metadata } from "next";
import { ArrowRight, Check, Mic } from "lucide-react";
import Link from "next/link";

import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { StudioImage } from "@/components/studio-image";
import { VoiceAssistantTrigger } from "@/components/voice-assistant";
import { services } from "@/lib/data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Photography Services",
  description: "Product, fashion, ghost mannequin, flat lay, jewellery, and lifestyle photography by LensCraft Studio.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services — 01"
        title="Crafted for commerce."
        intro="Six focused photography services, each adapted to your brand, platform, and production scale."
      />

      <section className="section-space bg-paper">
        <div className="page-shell space-y-24 lg:space-y-36">
          {services.map((service, index) => (
            <article
              id={service.slug}
              key={service.slug}
              className="scroll-mt-32 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-20"
            >
              <Reveal className={cn(index % 2 === 1 && "lg:order-2")}>
                <StudioImage
                  src={service.image}
                  title={service.name}
                  category={service.number}
                  orientation={index % 3 === 0 ? "landscape" : "portrait"}
                  className="max-h-[680px] w-full"
                />
              </Reveal>
              <Reveal delay={0.1}>
                <p className="eyebrow">Service {service.number}</p>
                <h2 className="mt-5 font-serif text-4xl leading-none sm:text-5xl lg:text-6xl">{service.name}</h2>
                <p className="mt-7 max-w-xl text-base leading-7 text-ink/60">{service.description}</p>
                <ul className="mt-8 space-y-3 border-y border-ink/15 py-6">
                  {service.details.map((detail) => (
                    <li key={detail} className="flex items-center gap-3 text-sm text-ink/70">
                      <Check className="h-3.5 w-3.5 text-bronze" /> {detail}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button asChild variant="outline"><Link href="/booking">Request this service <ArrowRight className="h-4 w-4" /></Link></Button>
                </div>
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-ink py-20 text-paper sm:py-28">
        <div className="page-shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <p className="eyebrow text-paper/45">A tailored approach</p>
            <h2 className="mt-5 max-w-3xl font-serif text-5xl leading-[0.95] sm:text-6xl">Need a blend of services?</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mb-7 max-w-md text-sm leading-6 text-paper/55">Tell us what the finished collection needs to do. We will shape the right production around it.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="light"><Link href="/booking">Request a booking <ArrowRight className="h-4 w-4" /></Link></Button>
              <VoiceAssistantTrigger className="border-paper/25 text-paper hover:border-paper hover:bg-paper hover:text-ink" variant="outline">Talk with LensCraft AI <Mic className="h-4 w-4" /></VoiceAssistantTrigger>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
