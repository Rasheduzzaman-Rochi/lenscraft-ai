import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { BookingActions } from "@/components/admin/booking-actions";
import { RetryButton } from "@/components/admin/retry-button";
import { AdminBackendError } from "@/lib/admin/backend";
import { getAdminBookings } from "@/lib/admin/backend";
import type { BookingStatus } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const statusOptions: Array<{ value: "all" | BookingStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
    timeZoneName: "short",
  }).format(new Date(value));
}

function filterHref(status: string, page = 1) {
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const value = query.toString();
  return `/admin/bookings${value ? `?${value}` : ""}`;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const query = await searchParams;
  const selected = statusOptions.some((option) => option.value === query.status) ? query.status! : "all";
  const parsedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const result = await getAdminBookings({
    status: selected === "all" ? undefined : selected as BookingStatus,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  }).then((value) => ({ value })).catch((error) => ({ error }));
  const data = "value" in result ? result.value : null;
  const loadError = "error" in result ? result.error : null;

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="border-b border-ink/10 pb-9">
        <p className="eyebrow">Studio calendar</p>
        <h1 className="mt-3 font-serif text-5xl tracking-[-0.03em] sm:text-6xl">Booking requests.</h1>
        <p className="mt-4 text-sm text-ink/50">Review customer details and move pending requests into their final status.</p>
      </div>

      <nav className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Filter bookings">
        {statusOptions.map((option) => (
          <Link
            key={option.value}
            href={filterHref(option.value)}
            className={cn(
              "shrink-0 px-4 py-3 text-[8px] font-semibold uppercase tracking-[0.18em] transition",
              selected === option.value ? "bg-ink text-paper" : "border border-ink/10 bg-paper text-ink/45 hover:border-ink/30 hover:text-ink",
            )}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {!data ? (
        <div className="mt-6 border border-[#b36a60]/30 bg-[#b36a60]/10 p-7 text-sm text-[#85483f]"><p className="eyebrow">Data unavailable</p><h2 className="mt-3 font-serif text-3xl">Booking data is temporarily unavailable.</h2><p className="mt-3 max-w-xl leading-6 text-ink/55">{loadError instanceof AdminBackendError && loadError.detail === "Admin API configuration is incomplete." ? "The server admin connection needs ADMIN_API_KEY before booking data can load." : "The studio connection did not respond. Your bookings are safe; try the request again."}</p><div className="mt-6"><RetryButton /></div></div>
      ) : data.items.length ? (
        <>
          <div className="mt-6 hidden overflow-x-auto border border-ink/10 bg-paper xl:block">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/10 text-[8px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                  <th className="px-5 py-4">Customer</th><th className="px-5 py-4">Contact</th><th className="px-5 py-4">Service</th><th className="px-5 py-4">Date/time</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Created</th><th className="px-5 py-4">Notes</th><th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {data.items.map((booking) => (
                  <tr key={booking.id} className="align-top transition hover:bg-bone/55">
                    <td className="px-5 py-5 font-serif text-lg">{booking.customer_name}</td>
                    <td className="px-5 py-5 text-xs text-ink/55">{booking.email ?? "—"}</td>
                    <td className="whitespace-nowrap px-5 py-5 text-xs text-ink/55">{booking.phone ?? "—"}</td>
                    <td className="px-5 py-5 text-sm text-ink/65">{booking.service ?? "Unspecified"}</td>
                    <td className="whitespace-nowrap px-5 py-5 text-xs text-ink/55">{formatDateTime(booking.date_time)}</td>
                    <td className="px-5 py-5"><StatusBadge status={booking.status} /></td>
                    <td className="whitespace-nowrap px-5 py-5 text-xs text-ink/45">{formatDateTime(booking.created_at)}</td>
                    <td className="max-w-[220px] px-5 py-5 text-xs leading-5 text-ink/50">{booking.notes ?? "—"}</td>
                    <td className="px-5 py-5"><Link href={`/admin/bookings/${booking.id}`} className="text-[8px] font-semibold uppercase tracking-[0.15em] text-bronze hover:text-ink">View details</Link>{booking.status === "pending" ? <div className="mt-3"><BookingActions bookingId={booking.id} /></div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-4 xl:hidden">
            {data.items.map((booking) => (
              <article key={booking.id} className="border border-ink/10 bg-paper p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl">{booking.customer_name}</h2><p className="mt-2 text-xs text-ink/45">{booking.email ?? "No email"} · {booking.phone ?? "No phone"}</p></div><StatusBadge status={booking.status} /></div>
                <dl className="mt-6 grid gap-5 border-y border-ink/10 py-5 sm:grid-cols-2">
                  <div><dt className="eyebrow">Service</dt><dd className="mt-2 text-sm">{booking.service ?? "Unspecified"}</dd></div>
                  <div><dt className="eyebrow">Appointment</dt><dd className="mt-2 text-sm">{formatDateTime(booking.date_time)}</dd></div>
                  <div className="sm:col-span-2"><dt className="eyebrow">Notes</dt><dd className="mt-2 text-sm leading-6 text-ink/55">{booking.notes ?? "No notes supplied."}</dd></div>
                </dl>
                <div className="mt-5 flex items-center justify-between gap-4"><Link href={`/admin/bookings/${booking.id}`} className="text-[9px] font-semibold uppercase tracking-[0.15em] text-bronze">View details</Link>{booking.status === "pending" ? <BookingActions bookingId={booking.id} /> : null}</div>
              </article>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-ink/10 pt-6">
            <p className="text-[9px] uppercase tracking-[0.16em] text-ink/40">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}</p>
            <div className="flex gap-2">
              {page > 1 ? <Link href={filterHref(selected, page - 1)} className="grid h-10 w-10 place-items-center border border-ink/15 bg-paper" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Link> : null}
              {page * PAGE_SIZE < data.total ? <Link href={filterHref(selected, page + 1)} className="grid h-10 w-10 place-items-center border border-ink/15 bg-paper" aria-label="Next page"><ChevronRight className="h-4 w-4" /></Link> : null}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 border border-ink/10 bg-paper px-7 py-16 text-center"><p className="font-serif text-3xl">No bookings found.</p><p className="mt-3 text-sm text-ink/45">There are no booking requests in this view.</p></div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={cn("inline-flex px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em]", status === "confirmed" ? "bg-[#dce8db] text-[#39523a]" : status === "pending" ? "bg-[#eee3cc] text-[#765b2c]" : status === "rejected" ? "bg-[#eedbd7] text-[#7b4038]" : "bg-ink/5 text-ink/45")}>{status}</span>;
}
