"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { AdminBooking } from "@/lib/admin/types";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(value));
}

export function BookingCalendar({ bookings }: { bookings: AdminBooking[] }) {
  const [month, setMonth] = useState(() => new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((start + days) / 7) * 7 }, (_, index) => {
    const day = index - start + 1;
    return day > 0 && day <= days ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
  const byDay = useMemo(() => bookings.reduce<Record<string, AdminBooking[]>>((groups, booking) => {
    const date = new Date(booking.date_time);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    (groups[key] ??= []).push(booking);
    return groups;
  }, {}), [bookings]);

  return (
    <section className="mt-10 border border-ink/10 bg-paper">
      <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5 sm:px-8">
        <div><p className="eyebrow">Schedule</p><h2 className="mt-2 font-serif text-3xl">Booking calendar</h2></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center border border-ink/15" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button><p className="min-w-32 text-center text-[9px] font-semibold uppercase tracking-[0.16em]">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(month)}</p><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center border border-ink/15" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button></div>
      </div>
      {bookings.length === 0 ? <p className="px-8 py-12 text-sm text-ink/45">No pending or confirmed bookings to place on the calendar.</p> : <div className="overflow-x-auto p-4 sm:p-6"><div className="min-w-[720px]"><div className="grid grid-cols-7 border-b border-ink/10">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <p key={day} className="px-2 py-3 text-center text-[8px] font-semibold uppercase tracking-[0.16em] text-ink/35">{day}</p>)}</div><div className="grid grid-cols-7 border-l border-t border-ink/10">{cells.map((date, index) => { const key = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : `empty-${index}`; const items = date ? byDay[key] ?? [] : []; return <div key={key} className="min-h-28 border-b border-r border-ink/10 p-2"><p className={`text-[9px] ${date && date.getMonth() === month.getMonth() ? "text-ink/60" : "text-transparent"}`}>{date?.getDate() ?? 0}</p><div className="mt-2 space-y-1">{items.map((booking) => <Link key={booking.id} href={`/admin/bookings/${booking.id}`} className={`block truncate border-l-2 px-2 py-1 text-[8px] leading-4 ${booking.status === "confirmed" ? "border-[#5d7b5f] bg-[#dce8db] text-[#39523a]" : "border-[#b08b4b] bg-[#eee3cc] text-[#765b2c]"}`} title={`${booking.customer_name} · ${booking.service ?? "Booking"}`}>{formatTime(booking.date_time)} · {booking.customer_name}</Link>)}</div></div>; })}</div></div></div>}
    </section>
  );
}