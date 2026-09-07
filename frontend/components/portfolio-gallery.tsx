"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { VisualPlaceholder } from "@/components/visual-placeholder";
import { portfolioItems } from "@/lib/data";
import { cn } from "@/lib/utils";

const categories = ["All", "Fashion", "Product", "Jewellery", "Lifestyle"];

export function PortfolioGallery() {
  const [active, setActive] = useState("All");
  const reduceMotion = useReducedMotion();
  const visible = active === "All" ? portfolioItems : portfolioItems.filter((item) => item.category === active);

  return (
    <>
      <div className="flex items-center justify-between gap-8 border-b border-ink/15 pb-5">
        <div className="flex gap-2 overflow-x-auto" aria-label="Filter portfolio">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActive(category)}
            aria-pressed={active === category}
            className={cn(
              "shrink-0 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] transition",
              active === category ? "bg-ink text-paper" : "text-ink/45 hover:text-ink",
            )}
          >
            {category}
          </button>
        ))}
        </div>
        <p className="hidden shrink-0 text-[9px] uppercase tracking-[0.18em] text-ink/30 md:block">{visible.length.toString().padStart(2, "0")} studies</p>
      </div>
      <motion.div layout className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3 lg:gap-6">
        <AnimatePresence mode="popLayout">
          {visible.map((item, index) => (
            <motion.div
              layout
              key={item.title}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.18) }}
              className="group relative mb-4 break-inside-avoid overflow-hidden bg-ink lg:mb-6"
            >
              <VisualPlaceholder {...item} className="transition duration-700 ease-out group-hover:scale-[1.025] group-hover:brightness-90" />
              <div className="pointer-events-none absolute inset-0 flex items-start justify-between p-5 opacity-0 transition duration-500 group-hover:opacity-100">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/10 text-white backdrop-blur-md"><ArrowUpRight className="h-4 w-4" /></span>
                <span className="text-[9px] uppercase tracking-[0.18em] text-white/70">Study {(index + 1).toString().padStart(2, "0")}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
