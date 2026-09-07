"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { VisualPlaceholder } from "@/components/visual-placeholder";
import { portfolioItems } from "@/lib/data";
import { cn } from "@/lib/utils";

const categories = ["All", ...Array.from(new Set(portfolioItems.map((item) => item.category)))];

export function PortfolioGallery() {
  const [active, setActive] = useState("All");
  const reduceMotion = useReducedMotion();
  const visible = active === "All" ? portfolioItems : portfolioItems.filter((item) => item.category === active);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto border-b border-ink/15 pb-5" aria-label="Filter portfolio">
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
      <motion.div layout className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3">
        <AnimatePresence mode="popLayout">
          {visible.map((item, index) => (
            <motion.div
              layout
              key={item.title}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.18) }}
              className="mb-5 break-inside-avoid"
            >
              <VisualPlaceholder {...item} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
