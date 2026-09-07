import { ArrowRight, CalendarCheck, CalendarClock, CalendarDays, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { getAdminDashboard } from "@/lib/admin/backend";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard().catch(() => null);

  if (!data) {
    return (
      <div className="border border-[#b36a60]/30 bg-[#b36a60]/10 p-7">
        <p className="eyebrow text-[#85483f]">Data unavailable</p>
        <h1 className="mt-3 font-serif text-4xl">The studio overview could not be loaded.</h1>
        <p className="mt-4 text-sm text-ink/55">Check the backend admin configuration and try refreshing this page.</p>
      </div>
    );
  }

  const stats = [
    { label: "Total bookings", value: data.bookings.total, icon: CalendarDays },
    { label: "Pending review", value: data.bookings.pending, icon: CalendarClock },
    { label: "Confirmed", value: data.bookings.confirmed, icon: CalendarCheck },
    { label: "Recent leads", value: data.recent_leads.length, icon: UserRoundPlus },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-col gap-6 border-b border-ink/10 pb-9 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Studio overview</p>
          <h1 className="mt-3 font-serif text-5xl tracking-[-0.03em] sm:text-6xl">Good morning.</h1>
          <p className="mt-4 text-sm text-ink/50">A current view of enquiries and booking activity.</p>
        </div>
        <Link href="/admin/bookings" className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] transition hover:text-bronze">Manage bookings <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <article key={label} className="border border-ink/10 bg-paper p-6 shadow-[0_14px_45px_rgba(23,22,18,0.04)]">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/40">{label}</p>
              <Icon className="h-4 w-4 text-bronze" strokeWidth={1.4} />
            </div>
            <p className="mt-8 font-serif text-5xl tracking-[-0.04em]">{value.toLocaleString()}</p>
          </article>
        ))}
      </div>

      <section className="mt-10 border border-ink/10 bg-paper">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5 sm:px-8">
          <div>
            <p className="eyebrow">Sales enquiries</p>
            <h2 className="mt-2 font-serif text-3xl">Recent leads</h2>
          </div>
          <span className="text-[9px] uppercase tracking-[0.16em] text-ink/35">Latest {data.recent_leads.length}</span>
        </div>
        {data.recent_leads.length ? (
          <div className="divide-y divide-ink/10">
            {data.recent_leads.map((lead) => (
              <article key={lead.id} className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center sm:px-8">
                <div>
                  <p className="font-serif text-xl">{lead.customer_name ?? "Unassigned enquiry"}</p>
                  <p className="mt-1 text-xs text-ink/45">{lead.email ?? "No email supplied"}</p>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-ink/55">{lead.intent ?? "Project requirements awaiting review."}</p>
                <div className="sm:text-right">
                  <span className="inline-flex bg-bone px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-ink/55">{lead.status}</span>
                  <p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-ink/35">{formatDate(lead.created_at)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="px-8 py-12 text-sm text-ink/45">No leads have been recorded yet.</p>
        )}
      </section>
    </div>
  );
}
