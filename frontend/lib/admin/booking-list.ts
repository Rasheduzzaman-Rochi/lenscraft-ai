export const ADMIN_BOOKINGS_PAGE_SIZE = 25;

/** Booking list text filters; `from`/`to` are inclusive studio-local calendar dates (YYYY-MM-DD). */
export type BookingTextFilters = { search: string; service: string; from: string; to: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function readBookingFilters(query: URLSearchParams): BookingTextFilters {
  const date = (key: string) => {
    const value = query.get(key) ?? "";
    return DATE.test(value) ? value : "";
  };
  return {
    search: (query.get("search") ?? "").trim().slice(0, 100),
    service: (query.get("service") ?? "").trim().slice(0, 200),
    from: date("from"),
    to: date("to"),
  };
}

/** The day after a YYYY-MM-DD calendar date, used to make inclusive date filters half-open. */
export function nextCalendarDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
