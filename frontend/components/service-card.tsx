import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Service } from "@/lib/data";
import { VisualPlaceholder } from "@/components/visual-placeholder";

export function ServiceCard({ service, featured = false }: { service: Service; featured?: boolean }) {
  return (
    <article className="group border-t border-ink/20 pt-4">
      <div className="mb-6 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-ink/45">
        <span>{service.number}</span>
        <span>LensCraft service</span>
      </div>
      {featured ? (
        <VisualPlaceholder
          title={service.name}
          tone={service.tone}
          orientation="landscape"
          minimal
          className="mb-7 overflow-hidden transition duration-700 group-hover:brightness-105"
        />
      ) : null}
      <h3 className="font-serif text-3xl leading-tight text-ink">{service.name}</h3>
      <p className="mt-4 max-w-md text-sm leading-6 text-ink/60">{service.shortDescription}</p>
      <Link
        href={`/services#${service.slug}`}
        className="mt-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink transition hover:text-bronze"
      >
        Explore service <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}
