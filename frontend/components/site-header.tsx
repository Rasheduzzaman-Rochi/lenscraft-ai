"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
      <div className="page-shell flex h-20 items-center justify-between sm:h-24">
        <Link href="/" className="relative z-50 flex items-baseline gap-2" onClick={() => setOpen(false)}>
          <span className="font-serif text-2xl tracking-[-0.04em]">LensCraft</span>
          <span className="text-[8px] font-semibold uppercase tracking-[0.28em] text-bronze">Studio</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "nav-link",
                pathname === link.href && "text-bronze after:scale-x-100",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/booking" className="border border-ink bg-ink px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-paper transition hover:border-bronze hover:bg-bronze">
            Book a shoot
          </Link>
        </nav>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="relative z-50 grid h-11 w-11 place-items-center md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            aria-label="Mobile navigation"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-x-0 top-full border-b border-ink/10 bg-paper px-5 pb-8 pt-4 shadow-soft md:hidden"
          >
            <div className="flex flex-col">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-ink/10 py-5 font-serif text-3xl"
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/booking" onClick={() => setOpen(false)} className="mt-6 bg-ink px-5 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-paper">
                Book a shoot
              </Link>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
