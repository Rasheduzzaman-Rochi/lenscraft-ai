import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PageHero } from "@/components/page-hero";
import { PortfolioGallery } from "@/components/portfolio-gallery";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Selected product, fashion, jewellery, flat lay, and lifestyle photography from LensCraft Studio.",
};

export default function PortfolioPage() {
  return (
    <>
      <PageHero
        eyebrow="Portfolio — 02"
        title="Selected observations."
        intro="A developing archive of precise still life, expressive fashion, and imagery with a strong sense of place."
      />
      <section className="section-space bg-paper">
        <div className="page-shell">
          <Reveal>
            <PortfolioGallery />
          </Reveal>
        </div>
      </section>
      <section className="border-t border-ink/15 bg-bone py-16">
        <div className="page-shell grid gap-6 md:grid-cols-3 md:items-end">
          <p className="eyebrow">A note on the work</p>
          <div className="md:col-span-2">
            <p className="max-w-3xl font-serif text-3xl leading-tight sm:text-4xl">Have a collection ready to become the next study?</p>
            <div className="mt-7"><Button asChild><Link href="/booking">Start your project <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </div>
      </section>
    </>
  );
}
