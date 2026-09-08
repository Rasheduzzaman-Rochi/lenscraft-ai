import { Aperture, ArrowDown, ArrowRight, Clock3, Mic, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { StudioImage } from "@/components/studio-image";
import { VoiceAssistantTrigger } from "@/components/voice-assistant";
import { portfolioItems, processSteps, services } from "@/lib/data";
import { images } from "@/lib/images";

const reasons = [
  { icon: ScanLine, title: "Detail, directed", text: "Every surface, silhouette, and shadow is shaped with commercial purpose." },
  { icon: ShieldCheck, title: "Consistent at scale", text: "Repeatable systems keep a single hero image and a full catalogue equally considered." },
  { icon: Clock3, title: "Calm production", text: "Clear planning, responsive communication, and dependable delivery from brief to final files." },
];

export default function HomePage() {
  return (
    <>
      <section className="relative min-h-screen overflow-hidden bg-bone pt-32 sm:pt-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_26%,rgba(154,117,78,0.16),transparent_28%),linear-gradient(to_right,rgba(23,22,18,0.035)_1px,transparent_1px)] bg-[size:auto,8vw_100%]" />
        <p className="pointer-events-none absolute -right-4 top-28 hidden font-serif text-[15vw] leading-none tracking-[-0.08em] text-ink/[0.025] xl:block">LENS</p>
        <div className="page-shell relative grid min-h-[calc(100vh-10rem)] gap-12 pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="relative z-10 pb-8 lg:pb-16">
            <Reveal>
              <div className="flex items-center gap-4"><Aperture className="h-4 w-4 text-bronze" strokeWidth={1.2} /><p className="eyebrow">Commercial photography studio — Est. 2026</p></div>
              <h1 className="mt-8 max-w-4xl font-serif text-[clamp(4.4rem,10.5vw,10rem)] leading-[0.76] tracking-[-0.06em] text-ink">
                Make them <span className="italic text-bronze">look twice.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12} className="mt-9 grid gap-7 sm:grid-cols-[1fr_auto] sm:items-end">
              <p className="max-w-md text-base leading-7 text-ink/60">
                Art-directed product and fashion photography for ambitious brands that care how they are seen, remembered, and chosen.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="shadow-[0_16px_35px_rgba(23,22,18,0.15)]"><Link href="/booking">Start your project <ArrowRight className="h-4 w-4" /></Link></Button>
                <VoiceAssistantTrigger variant="outline">Talk with LensCraft AI <Mic className="h-4 w-4" /></VoiceAssistantTrigger>
              </div>
            </Reveal>
            <Reveal delay={0.2} className="mt-8"><Link href="/portfolio" className="inline-flex items-center gap-2 border-b border-ink/25 pb-1 text-[9px] font-semibold uppercase tracking-[0.2em] transition hover:border-bronze hover:text-bronze">Explore selected work <ArrowRight className="h-3 w-3" /></Link></Reveal>
          </div>

          <Reveal delay={0.18} className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
            <StudioImage src={images.hero.main} title="Campaign Study" category="Featured work" priority className="aspect-[4/5] shadow-soft" sizes="(min-width: 1024px) 42vw, 90vw" />
            <div className="absolute -left-5 top-1/2 hidden w-32 -translate-y-1/2 bg-paper p-4 shadow-soft sm:block">
              <p className="font-serif text-3xl">01</p>
              <p className="mt-2 text-[8px] uppercase leading-4 tracking-[0.2em] text-ink/45">Light<br />Form<br />Feeling</p>
            </div>
          </Reveal>
          <Reveal delay={0.25} className="relative z-10 grid grid-cols-3 border-y border-ink/15 py-5 lg:col-span-2">
            <div><p className="font-serif text-2xl sm:text-3xl">06</p><p className="mt-1 text-[8px] uppercase tracking-[0.17em] text-ink/40">Specialist services</p></div>
            <div className="border-l border-ink/15 pl-5 sm:pl-8"><p className="font-serif text-2xl sm:text-3xl">01–01</p><p className="mt-1 text-[8px] uppercase tracking-[0.17em] text-ink/40">Creative direction</p></div>
            <div className="border-l border-ink/15 pl-5 sm:pl-8"><p className="font-serif text-2xl sm:text-3xl">24/7</p><p className="mt-1 text-[8px] uppercase tracking-[0.17em] text-ink/40">AI studio line</p></div>
          </Reveal>
        </div>
        <a href="#services" aria-label="Scroll to services" className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-ink/45 transition hover:text-ink lg:block">
          <ArrowDown className="h-5 w-5 animate-bounce" strokeWidth={1} />
        </a>
      </section>

      <section className="overflow-hidden bg-ink py-16 text-paper sm:py-24">
        <div className="page-shell">
          <Reveal className="flex items-end justify-between gap-8">
            <div><p className="eyebrow text-paper/40">Current visual studies</p><h2 className="mt-4 max-w-2xl font-serif text-4xl leading-none sm:text-5xl">A point of view, before the shutter.</h2></div>
            <p className="hidden max-w-xs text-right text-xs leading-5 text-paper/45 md:block">Light, material, colour, and movement composed into images with commercial purpose.</p>
          </Reveal>
          <div className="mt-12 grid grid-cols-12 items-end gap-3 sm:gap-5">
            <Reveal className="col-span-7 sm:col-span-5"><StudioImage src={portfolioItems[7].image} {...portfolioItems[7]} className="aspect-[4/5]" /></Reveal>
            <Reveal delay={0.1} className="col-span-5 sm:col-span-3"><StudioImage src={portfolioItems[2].image} {...portfolioItems[2]} className="aspect-[3/4]" /></Reveal>
            <Reveal delay={0.18} className="col-span-8 col-start-3 mt-6 sm:col-span-4 sm:col-start-auto sm:mt-0"><StudioImage src={portfolioItems[10].image} {...portfolioItems[10]} className="aspect-[5/4]" /></Reveal>
          </div>
        </div>
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
            <Reveal className="col-span-2 lg:col-span-5"><StudioImage src={portfolioItems[0].image} {...portfolioItems[0]} className="aspect-[4/5]" /></Reveal>
            <Reveal delay={0.08} className="col-span-1 lg:col-span-3"><StudioImage src={portfolioItems[2].image} {...portfolioItems[2]} className="aspect-[4/5]" /></Reveal>
            <Reveal delay={0.16} className="col-span-1 lg:col-span-4"><StudioImage src={portfolioItems[5].image} {...portfolioItems[5]} className="aspect-[4/5] lg:aspect-square" /></Reveal>
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
            <h2 className="mt-5 font-serif text-5xl leading-[0.92] sm:text-7xl">Your next project starts with a conversation.</h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-ink/60">
              Explore services, discuss a project, request an estimate, or find a suitable time—our AI studio assistant is ready when you are.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4"><VoiceAssistantTrigger className="shadow-[0_16px_35px_rgba(23,22,18,0.14)]">Talk with LensCraft AI <Mic className="h-4 w-4" /></VoiceAssistantTrigger><span className="text-[9px] uppercase tracking-[0.16em] text-ink/40">No waiting · Speak naturally</span></div>
          </Reveal>
          <Reveal delay={0.12} className="relative min-h-[420px] lg:min-h-[620px]">
            <StudioImage src={images.hero.assistant} title="The Studio Line" category="AI assisted" className="absolute inset-0 aspect-auto h-full w-full" sizes="(min-width: 1024px) 50vw, 100vw" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
