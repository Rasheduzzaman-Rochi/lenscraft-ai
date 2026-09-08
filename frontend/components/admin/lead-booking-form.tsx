"use client";

import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { AdminLead } from "@/lib/admin/types";

function defaultDateTime() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function LeadBookingForm({ lead }: { lead: AdminLead }) {
  const router = useRouter();
  const [service, setService] = useState(lead.service ?? "");
  const [dateTime, setDateTime] = useState(defaultDateTime());
  const [notes, setNotes] = useState(lead.intent ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const bookingResponse = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        customer: {
          name: lead.customer_name ?? "Lead customer",
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
        },
        date_time: new Date(dateTime).toISOString(),
        service_type: service.trim(),
        notes: notes.trim() || undefined,
        }),
      });
      if (!bookingResponse.ok) throw new Error("Booking creation failed");
      const result = await bookingResponse.json() as { booking_id: string };
      const statusResponse = await fetch(`/api/admin/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "converted" }),
      });
      if (!statusResponse.ok) throw new Error("Lead status update failed");
      router.push(`/admin/bookings/${result.booking_id}`);
      router.refresh();
    } catch {
      setError("The booking could not be created. Check the date, service, and studio connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 border border-ink/10 bg-paper p-6 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div><p className="eyebrow">Customer</p><p className="mt-2 font-serif text-2xl">{lead.customer_name ?? "Lead customer"}</p><p className="mt-1 text-xs text-ink/45">{lead.email ?? "No email"} · {lead.phone ?? "No phone"}</p></div>
        <div><label className="eyebrow" htmlFor="conversion-service">Service</label><input id="conversion-service" value={service} onChange={(event) => setService(event.target.value)} required maxLength={500} className="mt-2 h-12 w-full border border-ink/15 bg-transparent px-3 text-sm outline-none focus:border-ink" /></div>
        <div><label className="eyebrow" htmlFor="conversion-date">Appointment</label><input id="conversion-date" type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} required className="mt-2 h-12 w-full border border-ink/15 bg-transparent px-3 text-sm outline-none focus:border-ink" /></div>
        <div><label className="eyebrow" htmlFor="conversion-notes">Notes</label><textarea id="conversion-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} rows={3} className="mt-2 w-full border border-ink/15 bg-transparent p-3 text-sm outline-none focus:border-ink" /></div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-6"><Link href={`/admin/leads/${lead.id}`} className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink/45 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to lead</Link><button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-ink px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-bronze disabled:opacity-50">{busy ? <>Creating booking <LoaderCircle className="h-4 w-4 animate-spin" /></> : <>Create pending booking <Check className="h-4 w-4" /></>}</button></div>
      {error ? <p role="alert" className="mt-4 text-sm text-[#8d433b]">{error}</p> : null}
    </form>
  );
}
