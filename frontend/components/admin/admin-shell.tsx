"use client";

import { CalendarDays, LayoutDashboard, LogOut, Menu, Settings, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [email, setEmail] = useState<string>();

  useEffect(() => {
    void createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? undefined)).catch(() => null);
  }, []);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-ink">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[280px] border-r border-paper/10 bg-ink text-paper transition-transform duration-300 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-full flex-col px-6 py-7">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-baseline gap-2" onClick={() => setOpen(false)}>
              <span className="font-serif text-2xl tracking-[-0.04em]">LensCraft</span>
              <span className="text-[8px] font-semibold uppercase tracking-[0.28em] text-clay">Admin</span>
            </Link>
            <button type="button" onClick={() => setOpen(false)} className="lg:hidden" aria-label="Close navigation"><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-10 border-y border-paper/10 py-5 text-[9px] uppercase leading-5 tracking-[0.18em] text-paper/35">Studio operations<br />Private workspace</p>

          <nav className="mt-8 space-y-2" aria-label="Admin navigation">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition",
                    active ? "bg-paper text-ink" : "text-paper/55 hover:bg-paper/10 hover:text-paper",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.4} /> {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-paper/10 pt-6">
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-paper/45 transition hover:text-paper disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" /> {loggingOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      </aside>

      {open ? <button type="button" className="fixed inset-0 z-40 bg-ink/45 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay" /> : null}

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-ink/10 bg-[#f4f1ea]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-12">
          <button type="button" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <div className="hidden items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/40 sm:flex"><UserRound className="h-3.5 w-3.5" />{email ?? "Studio admin"}</div>
          <Link href="/" className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink/45 transition hover:text-bronze">View website</Link>
        </header>
        <div className="px-5 py-10 sm:px-8 lg:px-12 lg:py-14">{children}</div>
      </div>
    </div>
  );
}
