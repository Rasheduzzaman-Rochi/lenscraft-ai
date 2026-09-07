import type { Metadata } from "next";

import { PageHero } from "@/components/page-hero";
import { PortfolioGallery } from "@/components/portfolio-gallery";
import { Reveal } from "@/components/reveal";

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
        <div className="page-shell grid gap-6 md:grid-cols-3">
          <p className="eyebrow">A note on the work</p>
          <p className="max-w-xl font-serif text-3xl leading-tight md:col-span-2 sm:text-4xl">
            These art-directed placeholders establish the visual system. Final commissioned photography can replace each frame without changing the layout.
          </p>
        </div>
      </section>
    </>
  );
}
