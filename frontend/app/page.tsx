import { ArrowDown, ArrowRight, Clock3, MessagesSquare, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { VisualPlaceholder } from "@/components/visual-placeholder";
import { portfolioItems, processSteps, services } from "@/lib/data";

const reasons = [
  { icon: ScanLine, title: "Detail, directed", text: "Every surface, silhouette, and shadow is shaped with commercial purpose." },
  { icon: ShieldCheck, title: "Consistent at scale", text: "Repeatable systems keep a single hero image and a full catalogue equally considered." },
  { icon: Clock3, title: "Calm production", text: "Clear planning, responsive communication, and dependable delivery from brief to final files." },
];

export default function HomePage() {
  return (
    <>
      <section className="relative min-h-screen overflow-hidden bg-bone pt-32 sm:pt-40">
        <div className="page-shell grid min-h-[calc(100vh-10rem)] gap-12 pb-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="relative z-10 pb-8 lg:pb-16">
            <Reveal>
              <p className="eyebrow">Commercial photography studio — Est. 2026</p>
              <h1 className="mt-7 max-w-4xl font-serif text-[clamp(4.4rem,10.5vw,10rem)] leading-[0.78] tracking-[-0.055em] text-ink">
                Images with <span className="italic text-bronze">intent.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12} className="mt-9 grid gap-7 sm:grid-cols-[1fr_auto] sm:items-end">
              <p className="max-w-md text-base leading-7 text-ink/60">
                Elevated product and fashion photography for brands that care how they are seen, remembered, and chosen.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild><Link href="/booking">Book a shoot <ArrowRight className="h-4 w-4" /></Link></Button>
                <Button asChild variant="outline"><Link href="/portfolio">View work</Link></Button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.18} className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
            <VisualPlaceholder title="Campaign Study" category="Featured work" tone="noir" className="aspect-[4/5] shadow-soft" />
            <div className="absolute -left-5 top-1/2 hidden w-32 -translate-y-1/2 bg-paper p-4 shadow-soft sm:block">
              <p className="font-serif text-3xl">01</p>
              <p className="mt-2 text-[8px] uppercase leading-4 tracking-[0.2em] text-ink/45">Light<br />Form<br />Feeling</p>
            </div>
          </Reveal>
        </div>
        <a href="#services" aria-label="Scroll to services" className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-ink/45 transition hover:text-ink lg:block">
          <ArrowDown className="h-5 w-5 animate-bounce" strokeWidth={1} />
        </a>
      </section>

      <section id="services" className="section-space bg-paper">
        <div className="page-shell">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <Reveal><SectionHeading eyebrow="What we create" title="Built to hold attention." /></Reveal>
            <Reveal delay={0.1}>
              <p className="max-w-xl text-base leading-7 text-ink/60 lg:ml-auto">
                From exact e-commerce consistency to atmospheric campaign imagery, each service is shaped around where your images need to work.
              </p>
            </Reveal>
          </div>
          <div className="mt-16 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 3).map((service, index) => (
              <Reveal key={service.slug} delay={index * 0.08}><ServiceCard service={service} featured /></Reveal>
            ))}
          </div>
          <div className="mt-12 flex justify-end">
            <Button asChild variant="outline"><Link href="/services">Explore all services <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </section>

      <section className="section-space bg-ink text-paper">
        <div className="page-shell">
          <Reveal><SectionHeading eyebrow="Selected frames" title="A study in material, mood, and movement." light /></Reveal>
          <div className="mt-16 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-12 lg:items-end">
            <Reveal className="col-span-2 lg:col-span-5"><VisualPlaceholder {...portfolioItems[0]} className="aspect-[4/5]" /></Reveal>
            <Reveal delay={0.08} className="col-span-1 lg:col-span-3"><VisualPlaceholder {...portfolioItems[2]} className="aspect-[4/5]" /></Reveal>
            <Reveal delay={0.16} className="col-span-1 lg:col-span-4"><VisualPlaceholder {...portfolioItems[5]} className="aspect-[4/5] lg:aspect-square" /></Reveal>
          </div>
          <div className="mt-10 flex justify-end">
            <Button asChild variant="light"><Link href="/portfolio">View the portfolio <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </section>

      <section className="section-space bg-bone">
        <div className="page-shell">
          <Reveal><SectionHeading eyebrow="The LensCraft difference" title="Precision without the noise." intro="A senior, thoughtful studio experience designed around beautiful work and clear business outcomes." /></Reveal>
          <div className="mt-16 grid gap-8 border-t border-ink/15 pt-10 md:grid-cols-3">
            {reasons.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} delay={index * 0.08}>
                <Icon className="h-7 w-7 text-bronze" strokeWidth={1.25} />
                <h3 className="mt-7 font-serif text-3xl">{title}</h3>
                <p className="mt-4 max-w-sm text-sm leading-6 text-ink/55">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space bg-paper">
        <div className="page-shell grid gap-16 lg:grid-cols-[0.7fr_1.3fr]">
          <Reveal>
            <SectionHeading eyebrow="Our process" title="Considered at every step." intro="Good production should feel composed long before the camera comes out." />
          </Reveal>
          <div className="divide-y divide-ink/15 border-y border-ink/15">
            {processSteps.map((step, index) => (
              <Reveal key={step.number} delay={index * 0.05}>
                <article className="grid gap-4 py-7 sm:grid-cols-[3rem_0.5fr_1fr] sm:items-baseline">
                  <span className="text-[10px] tracking-[0.2em] text-bronze">{step.number}</span>
                  <h3 className="font-serif text-2xl">{step.title}</h3>
                  <p className="text-sm leading-6 text-ink/55">{step.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-clay">
        <div className="page-shell grid lg:grid-cols-2">
          <Reveal className="flex flex-col justify-center py-20 sm:py-28 lg:pr-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-ink/25"><Sparkles className="h-5 w-5" strokeWidth={1.25} /></div>
            <p className="eyebrow mt-8">Always available</p>
            <h2 className="mt-5 font-serif text-5xl leading-[0.95] sm:text-6xl">Meet your studio assistant.</h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-ink/60">
              Explore services, discuss a project, request an estimate, or find a suitable time—our AI studio assistant is ready when you are.
            </p>
            <div className="mt-8"><Button asChild><Link href="/contact">Start a conversation <MessagesSquare className="h-4 w-4" /></Link></Button></div>
          </Reveal>
          <Reveal delay={0.12} className="relative min-h-[420px] lg:min-h-[620px]">
            <VisualPlaceholder title="The Studio Line" category="AI assisted" tone="bronze" className="absolute inset-0 aspect-auto h-full w-full" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
