import { ArrowUpRight, Camera } from "lucide-react";
import Link from "next/link";

const footerLinks = [
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/contact", label: "Contact" },
  { href: "/booking", label: "Book a shoot" },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-paper">
      <div className="page-shell py-16 sm:py-20">
        <div className="grid gap-14 border-b border-paper/15 pb-14 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <div>
            <p className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">LensCraft <span className="italic text-clay">Studio</span></p>
            <p className="mt-5 max-w-md text-sm leading-6 text-paper/55">
              Refined commercial photography for products, fashion, and brands with something worth seeing.
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-paper/40">Explore</p>
            <div className="mt-5 flex flex-col gap-3">
              {footerLinks.map((link) => (
                <Link key={link.href} href={link.href} className="w-fit text-sm text-paper/75 transition hover:text-paper">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-paper/40">Connect</p>
            <a href="mailto:hello@lenscraft.studio" className="mt-5 flex items-center gap-2 text-sm text-paper/75 hover:text-paper">
              hello@lenscraft.studio <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <div className="mt-4 flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-paper/40">
              <Camera className="h-4 w-4" /> Visual journal
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-6 text-[9px] uppercase tracking-[0.18em] text-paper/35 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LensCraft Studio</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p>Photography, considered.</p>
            <span className="hidden h-3 w-px bg-paper/15 sm:block" aria-hidden="true" />
            <Link
              href="/admin/login"
              className="text-paper/30 transition hover:text-paper/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-clay focus-visible:ring-offset-4 focus-visible:ring-offset-ink"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
