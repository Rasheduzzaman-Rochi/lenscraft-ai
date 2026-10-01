import { BookingsBrowser } from "@/components/admin/bookings-browser";
import { adminConnectionMessage, getAdminBookings } from "@/lib/admin/backend";
import { ADMIN_BOOKINGS_PAGE_SIZE, nextCalendarDate, readBookingFilters } from "@/lib/admin/booking-list";
import { getAdminDisplaySettings, getAdminServices } from "@/lib/admin/records";
import { zonedLocalToIso } from "@/lib/admin/time";
import type { BookingStatus } from "@/lib/admin/types";

const validStatuses = new Set<BookingStatus>(["pending", "confirmed", "rejected", "cancelled"]);

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const selected = query.status && validStatuses.has(query.status as BookingStatus)
    ? query.status as BookingStatus
    : "all";
  const parsedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const filters = readBookingFilters(new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ));
  const [display, services] = await Promise.all([
    getAdminDisplaySettings(),
    getAdminServices({ limit: 100 }).then((list) => list.items.map((service) => service.name)).catch(() => []),
  ]);
  const result = await getAdminBookings({
    status: selected === "all" ? undefined : selected,
    search: filters.search || undefined,
    service: filters.service || undefined,
    dateFrom: filters.from ? zonedLocalToIso(`${filters.from}T00:00`, display.timeZone) : undefined,
    dateTo: filters.to ? zonedLocalToIso(`${nextCalendarDate(filters.to)}T00:00`, display.timeZone) : undefined,
    limit: ADMIN_BOOKINGS_PAGE_SIZE,
    offset: (page - 1) * ADMIN_BOOKINGS_PAGE_SIZE,
  }).then((value) => ({ value })).catch((error: unknown) => ({ error }));

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="border-b border-ink/10 pb-9">
        <p className="eyebrow">Studio calendar</p>
        <h1 className="mt-3 font-serif text-5xl tracking-[-0.03em] sm:text-6xl">Booking requests.</h1>
        <p className="mt-4 text-sm text-ink/50">Review customer details and move pending requests into their final status.</p>
      </div>

      <BookingsBrowser
        initialData={"value" in result ? result.value : null}
        initialError={"error" in result ? adminConnectionMessage(result.error) : null}
        initialPage={page}
        initialStatus={selected}
        initialFilters={filters}
        services={services}
        timeZone={display.timeZone}
      />
    </div>
  );
}
