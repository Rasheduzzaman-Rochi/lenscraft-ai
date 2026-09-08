"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { BookingActions } from "@/components/admin/booking-actions";
import { ADMIN_BOOKINGS_PAGE_SIZE } from "@/lib/admin/booking-list";
import type { AdminBookingList, BookingStatus } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | BookingStatus;

const statusOptions: Array<{ value: FilterStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

type Props = {
  initialData: AdminBookingList | null;
  initialError: string | null;
  initialPage: number;
  initialStatus: FilterStatus;
};

function cacheKey(status: FilterStatus, page: number) {
  return `${status}:${page}`;
}

function pageUrl(status: FilterStatus, page: number) {
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const value = query.toString();
  return `/admin/bookings${value ? `?${value}` : ""}`;
}

function apiUrl(status: FilterStatus, page: number) {
  const query = new URLSearchParams({
    limit: String(ADMIN_BOOKINGS_PAGE_SIZE),
    offset: String((page - 1) * ADMIN_BOOKINGS_PAGE_SIZE),
  });
  if (status !== "all") query.set("status", status);
  return `/api/admin/bookings?${query}`;
}

function readLocation(): { status: FilterStatus; page: number } {
  const query = new URLSearchParams(window.location.search);
  const rawStatus = query.get("status");
  const status = statusOptions.some((option) => option.value === rawStatus)
    ? rawStatus as FilterStatus
    : "all";
  const parsedPage = Number.parseInt(query.get("page") ?? "1", 10);
  return {
    status,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

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

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={cn(
      "inline-flex px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em]",
      status === "confirmed" ? "bg-[#dce8db] text-[#39523a]" :
        status === "pending" ? "bg-[#eee3cc] text-[#765b2c]" :
          status === "rejected" ? "bg-[#eedbd7] text-[#7b4038]" :
            "bg-ink/5 text-ink/45",
    )}>{status}</span>
  );
}

async function fetchBookings(status: FilterStatus, page: number) {
  const response = await fetch(apiUrl(status, page), {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload &&
      typeof payload.message === "string"
      ? payload.message
      : "Booking data is temporarily unavailable.";
    throw new Error(message);
  }
  return payload as AdminBookingList;
}

export function BookingsBrowser({ initialData, initialError, initialPage, initialStatus }: Props) {
  const [selected, setSelected] = useState(initialStatus);
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, AdminBookingList>());
  const requests = useRef(new Map<string, Promise<AdminBookingList>>());
  const activeRequest = useRef(0);

  if (initialData && cache.current.size === 0) {
    cache.current.set(cacheKey(initialStatus, initialPage), initialData);
  }

  const load = useCallback(async (status: FilterStatus, nextPage: number, options?: { force?: boolean; history?: "replace" | "none" }) => {
    const requestId = ++activeRequest.current;
    setSelected(status);
    setPage(nextPage);
    setError(null);

    if (options?.history !== "none") {
      window.history.replaceState(window.history.state, "", pageUrl(status, nextPage));
    }

    const key = cacheKey(status, nextPage);
    const cached = options?.force ? undefined : cache.current.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let request = requests.current.get(key);
      if (!request || options?.force) {
        request = fetchBookings(status, nextPage);
        requests.current.set(key, request);
        void request.finally(() => {
          if (requests.current.get(key) === request) requests.current.delete(key);
        }).catch(() => undefined);
      }
      const result = await request;
      cache.current.set(key, result);
      if (activeRequest.current === requestId) setData(result);
    } catch (loadError) {
      if (activeRequest.current === requestId) {
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Booking data is temporarily unavailable.");
      }
    } finally {
      if (activeRequest.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const location = readLocation();
      void load(location.status, location.page, { history: "none" });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [load]);

  return (
    <>
      <nav className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Filter bookings" aria-busy={loading}>
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => void load(option.value, 1)}
            disabled={loading && selected === option.value}
            aria-pressed={selected === option.value}
            className={cn(
              "shrink-0 px-4 py-3 text-[8px] font-semibold uppercase tracking-[0.18em] transition disabled:cursor-wait disabled:opacity-70",
              selected === option.value ? "bg-ink text-paper" : "border border-ink/10 bg-paper text-ink/45 hover:border-ink/30 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink/40" role="status">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Updating bookings
        </div>
      ) : null}

      {!data ? (
        <div className="mt-6 border border-[#b36a60]/30 bg-[#b36a60]/10 p-7 text-sm text-[#85483f]">
          <p className="eyebrow">Data unavailable</p>
          <h2 className="mt-3 font-serif text-3xl">Booking data is temporarily unavailable.</h2>
          <p className="mt-3 max-w-xl leading-6 text-ink/55">{error ?? "The studio connection did not respond. Please try again."} Your bookings are safe.</p>
          <button type="button" onClick={() => void load(selected, page, { force: true })} disabled={loading} className="mt-6 border border-ink/20 bg-paper px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink disabled:cursor-wait disabled:opacity-60">Try again</button>
        </div>
      ) : data.items.length ? (
        <div className={cn("transition-opacity", loading && "pointer-events-none opacity-55")} aria-live="polite">
          <div className="mt-6 hidden overflow-x-auto border border-ink/10 bg-paper xl:block">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/10 text-[8px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                  <th className="px-5 py-4">Customer</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Phone</th><th className="px-5 py-4">Service</th><th className="px-5 py-4">Date/time</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Created</th><th className="px-5 py-4">Notes</th><th className="px-5 py-4">Actions</th>
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
                    <td className="px-5 py-5"><Link href={`/admin/bookings/${booking.id}`} className="text-[8px] font-semibold uppercase tracking-[0.15em] text-bronze hover:text-ink">View details</Link>{booking.status === "pending" ? <div className="mt-3"><BookingActions bookingId={booking.id} currentStatus={booking.status} /></div> : null}</td>
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
                <div className="mt-5 flex items-center justify-between gap-4"><Link href={`/admin/bookings/${booking.id}`} className="text-[9px] font-semibold uppercase tracking-[0.15em] text-bronze">View details</Link>{booking.status === "pending" ? <BookingActions bookingId={booking.id} currentStatus={booking.status} /> : null}</div>
              </article>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-ink/10 pt-6">
            <p className="text-[9px] uppercase tracking-[0.16em] text-ink/40">Showing {(page - 1) * ADMIN_BOOKINGS_PAGE_SIZE + 1}–{Math.min(page * ADMIN_BOOKINGS_PAGE_SIZE, data.total)} of {data.total}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void load(selected, page - 1)} disabled={loading || page <= 1} className="grid h-10 w-10 place-items-center border border-ink/15 bg-paper disabled:cursor-not-allowed disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => void load(selected, page + 1)} disabled={loading || page * ADMIN_BOOKINGS_PAGE_SIZE >= data.total} className="grid h-10 w-10 place-items-center border border-ink/15 bg-paper disabled:cursor-not-allowed disabled:opacity-30" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 border border-ink/10 bg-paper px-7 py-16 text-center"><p className="font-serif text-3xl">No bookings found.</p><p className="mt-3 text-sm text-ink/45">There are no booking requests in this view.</p></div>
      )}
    </>
  );
}
