import { ArrowRight, CalendarCheck, CalendarClock, CalendarDays, CircleAlert, UserRoundPlus } from "lucide-react";
import Link from "next/link";

import { adminConnectionMessage, getAdminBookings, getAdminDashboard } from "@/lib/admin/backend";
import { RetryButton } from "@/components/admin/retry-button";
import { BookingCalendar } from "@/components/admin/booking-calendar";
import type { AdminBooking, AdminDashboard } from "@/lib/admin/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Dhaka", timeZoneName: "short",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: AdminBooking["status"] }) {
  return <span className={`inline-flex px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em] ${status === "confirmed" ? "bg-[#dce8db] text-[#39523a]" : status === "pending" ? "bg-[#eee3cc] text-[#765b2c]" : status === "rejected" ? "bg-[#eedbd7] text-[#7b4038]" : "bg-ink/5 text-ink/45"}`}>{status}</span>;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDashboard(raw: Partial<AdminDashboard> = {}) {
  const bookings: Partial<NonNullable<AdminDashboard["bookings"]>> = raw.bookings ?? {};
  const leads: NonNullable<AdminDashboard["leads"]> = raw.leads ?? {};
  return {
    bookings: {
      total: numberValue(bookings.total),
      pending: numberValue(bookings.pending),
      confirmed: numberValue(bookings.confirmed),
      rejected: numberValue(bookings.rejected),
      cancelled: numberValue(bookings.cancelled),
    },
    leads: {
      total: numberValue(leads.total ?? raw.total_leads),
      converted: numberValue(leads.converted ?? raw.converted_leads),
      estimatedRevenue: numberValue(leads.estimated_revenue ?? raw.revenue),
      conversionRate: numberValue(leads.conversion_rate ?? raw.conversion_rate),
    },
    recentLeads: Array.isArray(raw.recent_leads) ? raw.recent_leads : [],
  };
}

export default async function AdminDashboardPage() {
  const [dashboardResult, bookingsResult] = await Promise.allSettled([
    getAdminDashboard(),
    getAdminBookings({ limit: 100 }),
  ]);
  const data = dashboardResult.status === "fulfilled" ? dashboardResult.value : null;
  const bookings = bookingsResult.status === "fulfilled" ? bookingsResult.value.items : [];
  const calendarBookings = bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status.trim().toLowerCase()));
  const dashboardError = dashboardResult.status === "rejected" ? dashboardResult.reason : null;
  const dashboard = normalizeDashboard(data ?? {});
  if (!data && bookingsResult.status === "fulfilled") {
    dashboard.bookings.total = bookingsResult.value.total;
    dashboard.bookings.pending = bookings.filter((booking) => booking.status === "pending").length;
    dashboard.bookings.confirmed = bookings.filter((booking) => booking.status === "confirmed").length;
    dashboard.bookings.rejected = bookings.filter((booking) => booking.status === "rejected").length;
    dashboard.bookings.cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
  }
  const stats = [
    { label: "Total leads", value: dashboard.leads.total, icon: UserRoundPlus },
    { label: "Total bookings", value: dashboard.bookings.total, icon: CalendarDays },
    { label: "Pending review", value: dashboard.bookings.pending, icon: CalendarClock },
    { label: "Confirmed", value: dashboard.bookings.confirmed, icon: CalendarCheck },
    { label: "Estimated revenue", value: `৳${dashboard.leads.estimatedRevenue.toLocaleString("en-BD")}`, icon: UserRoundPlus },
    { label: "Conversion rate", value: `${dashboard.leads.conversionRate.toFixed(1)}%`, icon: UserRoundPlus },
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

      {dashboardError ? (
        <section className="mt-8 border border-[#b36a60]/30 bg-[#b36a60]/10 p-6">
          <div className="flex items-start gap-4">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#85483f]" />
            <div>
              <p className="eyebrow text-[#85483f]">Some metrics are unavailable</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/55">{adminConnectionMessage(dashboardError)}</p>
              <div className="mt-5"><RetryButton /></div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <article key={label} className="border border-ink/10 bg-paper p-6 shadow-[0_14px_45px_rgba(23,22,18,0.04)]">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/40">{label}</p>
              <Icon className="h-4 w-4 text-bronze" strokeWidth={1.4} />
            </div>
            <p className="mt-8 font-serif text-5xl tracking-[-0.04em]">{typeof value === "number" ? value.toLocaleString() : value}</p>
          </article>
        ))}
      </div>

      <section className="mt-10 border border-ink/10 bg-paper">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5 sm:px-8">
          <div>
            <p className="eyebrow">Sales enquiries</p>
            <h2 className="mt-2 font-serif text-3xl">Recent leads</h2>
          </div>
          <span className="text-[9px] uppercase tracking-[0.16em] text-ink/35">Latest {dashboard.recentLeads.length}</span>
        </div>
        {dashboard.recentLeads.length ? (
          <div className="divide-y divide-ink/10">
            {dashboard.recentLeads.map((lead) => (
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

      <BookingCalendar bookings={calendarBookings} />
      {bookingsResult.status === "rejected" ? <section className="mt-4 border border-[#b36a60]/30 bg-[#b36a60]/10 p-5"><p className="eyebrow text-[#85483f]">Calendar data unavailable</p><p className="mt-2 text-sm text-ink/55">{adminConnectionMessage(bookingsResult.reason)} The calendar remains available without event data.</p></section> : null}

      <section className="mt-10 border border-ink/10 bg-paper">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5 sm:px-8">
          <div><p className="eyebrow">Studio calendar</p><h2 className="mt-2 font-serif text-3xl">Recent bookings</h2></div>
          <Link href="/admin/bookings" className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] hover:text-bronze">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        {bookingsResult.status === "rejected" ? (
          <div className="px-8 py-10"><p className="text-sm text-ink/45">Recent bookings could not be loaded.</p><div className="mt-5"><RetryButton /></div></div>
        ) : bookings.length ? (
          <div className="divide-y divide-ink/10">
            {bookings.map((booking) => <Link key={booking.id} href={`/admin/bookings/${booking.id}`} className="grid gap-3 px-6 py-5 transition hover:bg-bone/45 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center sm:px-8"><div><p className="font-serif text-xl">{booking.customer_name}</p><p className="mt-1 text-xs text-ink/45">{booking.service ?? "Unspecified service"}</p></div><p className="text-xs text-ink/55">{formatDateTime(booking.date_time)}</p><StatusBadge status={booking.status} /><p className="text-[9px] uppercase tracking-[0.14em] text-ink/35">{formatDate(booking.created_at)}</p></Link>)}
          </div>
        ) : <p className="px-8 py-12 text-sm text-ink/45">No booking requests have been recorded yet.</p>}
      </section>
    </div>
  );
}
