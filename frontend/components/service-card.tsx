import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Service } from "@/lib/data";
import { StudioImage } from "@/components/studio-image";

export function ServiceCard({ service, featured = false }: { service: Service; featured?: boolean }) {
  return (
    <article className="group relative border-t border-ink/20 pt-4 transition duration-500 hover:border-bronze">
      <div className="mb-6 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-ink/45">
        <span>{service.number}</span>
        <span>LensCraft service</span>
      </div>
      {featured ? (
        <StudioImage
          src={service.image}
          title={service.name}
          orientation="landscape"
          minimal
          className="mb-7 overflow-hidden transition duration-700 ease-out group-hover:scale-[1.018] group-hover:brightness-105"
        />
      ) : null}
      <h3 className="font-serif text-3xl leading-tight text-ink">{service.name}</h3>
      <p className="mt-4 max-w-md text-sm leading-6 text-ink/60">{service.shortDescription}</p>
      <Link
        href={`/services#${service.slug}`}
        className="mt-6 inline-flex items-center gap-2 border-b border-transparent pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink transition group-hover:border-bronze group-hover:text-bronze"
      >
        Explore service <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}
