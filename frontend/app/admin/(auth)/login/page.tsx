import { Aperture } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { hasAdminSession } from "@/lib/admin/session";

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect("/admin");

  return (
    <div className="grid min-h-screen bg-ink text-paper lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-paper/10 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(185,169,149,0.28),transparent_30%),radial-gradient(circle_at_70%_70%,rgba(154,117,78,0.25),transparent_35%)]" />
        <div className="absolute left-[12%] top-[14%] h-[58%] w-[52%] rotate-[-7deg] border border-paper/15 bg-gradient-to-br from-clay/25 to-transparent shadow-2xl" />
        <div className="absolute bottom-[9%] right-[9%] h-[49%] w-[38%] rotate-[9deg] border border-paper/15 bg-gradient-to-br from-bronze/20 to-paper/5 shadow-2xl" />
        <div className="absolute inset-x-12 bottom-12 flex items-end justify-between border-t border-paper/15 pt-5">
          <p className="max-w-sm font-serif text-4xl leading-tight">A composed view of every studio commitment.</p>
          <Aperture className="h-7 w-7 text-clay" strokeWidth={1} />
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-16 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-3xl tracking-[-0.04em]">LensCraft</span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.28em] text-clay">Studio</span>
          </Link>
          <p className="mt-16 text-[9px] font-semibold uppercase tracking-[0.24em] text-clay">Private access</p>
          <h1 className="mt-5 font-serif text-5xl leading-[0.95] sm:text-6xl">Studio administration.</h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-paper/50">Sign in to review enquiries and manage booking requests.</p>
          <AdminLoginForm />
          <p className="mt-8 text-[9px] uppercase leading-5 tracking-[0.16em] text-paper/25">Protected by a signed, HTTP-only session.</p>
        </div>
      </section>
    </div>
  );
}
