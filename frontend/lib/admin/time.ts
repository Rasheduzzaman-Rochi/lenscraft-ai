/**
 * Studio-timezone helpers. Stored values are absolute instants (timestamptz); these helpers only
 * change how an instant is shown or how a studio wall-clock entry is converted to an instant.
 */

function zoneOffsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Convert a studio wall-clock value ("YYYY-MM-DDTHH:mm") in `timeZone` to an ISO UTC instant. */
export function zonedLocalToIso(local: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error("Invalid local date-time");
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallClock - zoneOffsetMs(wallClock, timeZone);
  const corrected = wallClock - zoneOffsetMs(instant, timeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant).toISOString();
}

/** Studio wall-clock value ("YYYY-MM-DDTHH:mm") for an instant, suitable for datetime-local inputs. */
export function isoToZonedLocal(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

/** Studio calendar date ("YYYY-MM-DD") of an instant. */
export function zonedDateKey(iso: string | Date, timeZone: string) {
  return isoToZonedLocal(typeof iso === "string" ? iso : iso.toISOString(), timeZone).slice(0, 10);
}

export function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone })
    .format(new Date(value));
}

export function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));
}

export function formatMoney(value: string | number | null | undefined, currency: string) {
  const amount = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 4 }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-US")} ${currency}`;
  }
}
