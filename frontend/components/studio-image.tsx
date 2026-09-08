import { Aperture } from "lucide-react";
import Image from "next/image";

import type { PortfolioItem } from "@/lib/data";
import { cn } from "@/lib/utils";

const orientationClasses: Record<PortfolioItem["orientation"], string> = {
  portrait: "aspect-[4/5]",
  landscape: "aspect-[5/4]",
  square: "aspect-square",
};

export function StudioImage({
  src,
  title,
  category,
  orientation = "portrait",
  className,
  minimal = false,
  priority = false,
  sizes = "(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw",
}: {
  src: string;
  title: string;
  category?: string;
  orientation?: PortfolioItem["orientation"];
  className?: string;
  minimal?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "group relative isolate overflow-hidden bg-clay/20",
        orientationClasses[orientation],
        className,
      )}
    >
      <Image
        src={src}
        alt={title}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover transition duration-1000 ease-out group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
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
