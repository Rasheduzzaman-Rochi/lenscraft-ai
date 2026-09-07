import { Aperture } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PortfolioItem, Service } from "@/lib/data";

const toneClasses: Record<Service["tone"], string> = {
  ivory: "from-[#d8d0c2] via-[#eee8dc] to-[#9d8e7c]",
  stone: "from-[#474943] via-[#a8aa9f] to-[#d3cec1]",
  bronze: "from-[#35271f] via-[#9a704d] to-[#d6b88f]",
  moss: "from-[#222b24] via-[#66705e] to-[#b7b69f]",
  noir: "from-[#0d0d0c] via-[#393a38] to-[#9a9690]",
  rose: "from-[#5b403c] via-[#bb9185] to-[#dbc8ba]",
};

const orientationClasses: Record<PortfolioItem["orientation"], string> = {
  portrait: "aspect-[4/5]",
  landscape: "aspect-[5/4]",
  square: "aspect-square",
};

export function VisualPlaceholder({
  title,
  category,
  tone = "stone",
  orientation = "portrait",
  className,
  minimal = false,
}: {
  title: string;
  category?: string;
  tone?: Service["tone"];
  orientation?: PortfolioItem["orientation"];
  className?: string;
  minimal?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={`Photography placeholder for ${title}`}
      className={cn(
        "group relative isolate overflow-hidden bg-gradient-to-br",
        toneClasses[tone],
        orientationClasses[orientation],
        className,
      )}
    >
      <div className="absolute -left-[12%] top-[12%] h-[58%] w-[58%] rounded-full border border-white/25 bg-white/10 blur-[1px] transition duration-700 group-hover:scale-105" />
      <div className="absolute right-[8%] top-[18%] h-[48%] w-[34%] rotate-12 border border-white/25 bg-black/10 shadow-2xl transition duration-700 group-hover:rotate-6" />
      <div className="absolute bottom-[12%] left-[18%] h-[24%] w-[46%] -rotate-6 rounded-[50%] bg-black/20 blur-sm" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.18)_49%,transparent_68%)] opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/5" />
      {!minimal ? (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-6">
          <div>
            {category ? <p className="text-[9px] uppercase tracking-[0.24em] text-white/65">{category}</p> : null}
            <p className="mt-1 font-serif text-2xl">{title}</p>
          </div>
          <Aperture className="h-4 w-4 shrink-0 text-white/55" strokeWidth={1.25} />
        </div>
      ) : null}
    </div>
  );
}
