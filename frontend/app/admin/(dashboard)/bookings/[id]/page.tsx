import { ArrowLeft, Mail, Phone } from "lucide-react";
import Link from "next/link";

import { BookingActions } from "@/components/admin/booking-actions";
import { RetryButton } from "@/components/admin/retry-button";
import { AdminBackendError, getAdminBooking } from "@/lib/admin/backend";
import type { BookingStatus } from "@/lib/admin/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka", timeZoneName: "short" }).format(new Date(value));
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-flex px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em] ${status === "confirmed" ? "bg-[#dce8db] text-[#39523a]" : status === "pending" ? "bg-[#eee3cc] text-[#765b2c]" : status === "rejected" ? "bg-[#eedbd7] text-[#7b4038]" : "bg-ink/5 text-ink/45"}`}>{status}</span>;
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminBooking(id).then((value) => ({ value })).catch((error) => ({ error }));
  if (!("value" in result)) {
    const notFound = result.error instanceof AdminBackendError && result.error.status === 404;
    return <div className="mx-auto max-w-4xl"><Link href="/admin/bookings" className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to bookings</Link><div className="mt-10 border border-[#b36a60]/30 bg-[#b36a60]/10 p-8"><p className="eyebrow text-[#85483f]">{notFound ? "Not found" : "Data unavailable"}</p><h1 className="mt-3 font-serif text-4xl">{notFound ? "Booking not found." : "Booking details could not be loaded."}</h1><p className="mt-4 text-sm leading-6 text-ink/55">{notFound ? "This booking may have been removed or belongs to another studio." : "The studio connection did not respond."}</p>{!notFound ? <div className="mt-6"><RetryButton /></div> : null}</div></div>;
  }

  const booking = result.value;
  const normalizedStatus = booking.status.trim().toLowerCase() as BookingStatus;
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/bookings" className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to bookings</Link>
      <div className="mt-8 flex flex-col gap-5 border-b border-ink/10 pb-8 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Booking detail</p><h1 className="mt-3 font-serif text-5xl tracking-[-0.03em]">{booking.customer_name}</h1><p className="mt-3 text-sm text-ink/50">Created {formatDateTime(booking.created_at)}</p></div><StatusBadge status={booking.status} /></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="border border-ink/10 bg-paper p-6 sm:p-8"><p className="eyebrow">Appointment</p><dl className="mt-6 grid gap-6 sm:grid-cols-2"><div><dt className="eyebrow">Service</dt><dd className="mt-2 font-serif text-2xl">{booking.service ?? "Unspecified"}</dd></div><div><dt className="eyebrow">Date & time</dt><dd className="mt-2 text-sm leading-6">{formatDateTime(booking.date_time)}</dd></div><div className="sm:col-span-2"><dt className="eyebrow">Notes</dt><dd className="mt-2 text-sm leading-6 text-ink/60">{booking.notes ?? "No notes supplied."}</dd></div></dl></section>
        <section className="border border-ink/10 bg-paper p-6 sm:p-8"><p className="eyebrow">Customer</p><h2 className="mt-3 font-serif text-3xl">{booking.customer_name}</h2><dl className="mt-6 space-y-5 text-sm"><div><dt className="eyebrow">Email</dt><dd className="mt-2"><a href={booking.email ? `mailto:${booking.email}` : undefined} className="inline-flex items-center gap-2 text-bronze hover:text-ink"><Mail className="h-3.5 w-3.5" />{booking.email ?? "Not supplied"}</a></dd></div><div><dt className="eyebrow">Phone</dt><dd className="mt-2"><a href={booking.phone ? `tel:${booking.phone}` : undefined} className="inline-flex items-center gap-2 text-bronze hover:text-ink"><Phone className="h-3.5 w-3.5" />{booking.phone ?? "Not supplied"}</a></dd></div><div><dt className="eyebrow">Company / brand</dt><dd className="mt-2 text-ink/60">{booking.business_name ?? "Not supplied"}</dd></div><div><dt className="eyebrow">Industry</dt><dd className="mt-2 text-ink/60">{booking.industry ?? "Not supplied"}</dd></div></dl></section>
      </div>
      {normalizedStatus === "pending" || normalizedStatus === "confirmed" ? <div className="mt-6 border border-ink/10 bg-paper p-6"><p className="eyebrow">Actions</p><div className="mt-4"><BookingActions bookingId={booking.id} currentStatus={normalizedStatus} /></div></div> : null}
    </div>
  );
}