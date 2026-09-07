import { Reveal } from "@/components/reveal";

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="border-b border-ink/15 bg-bone pt-36 sm:pt-44">
      <div className="page-shell grid gap-10 pb-16 sm:pb-20 lg:grid-cols-[1.35fr_0.65fr] lg:items-end lg:pb-24">
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-6 max-w-5xl font-serif text-[clamp(3.8rem,9vw,8.5rem)] leading-[0.82] tracking-[-0.04em] text-ink">
            {title}
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="max-w-md border-l border-bronze pl-6 text-base leading-7 text-ink/60">{intro}</p>
        </Reveal>
      </div>
    </section>
  );
}
