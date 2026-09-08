import type {
  AdminBooking,
  AdminBookingList,
  AdminDashboard,
  AdminLead,
  AdminLeadList,
  BookingStatus,
} from "@/lib/admin/types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function dateText(value: unknown) {
  const candidate = text(value);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : null;
}

function bookingStatus(value: unknown): BookingStatus | null {
  const normalized = text(value)?.toLowerCase();
  return normalized === "pending" || normalized === "confirmed" ||
    normalized === "rejected" || normalized === "cancelled"
    ? normalized
    : null;
}

function normalizeLead(value: unknown): AdminLead | null {
  const source = record(value);
  const id = text(source.id);
  const createdAt = dateText(source.created_at);
  if (!id || !createdAt) return null;
  return {
    id,
    customer_name: text(source.customer_name),
    email: text(source.email),
    phone: text(source.phone),
    business_name: text(source.business_name),
    industry: text(source.industry),
    service: text(source.service),
    source: text(source.source),
    status: text(source.status) ?? "new",
    intent: text(source.intent),
    estimated_value: typeof source.estimated_value === "number" || typeof source.estimated_value === "string"
      ? source.estimated_value
      : null,
    created_at: createdAt,
    project_details: record(source.project_details),
  };
}

function normalizeBooking(value: unknown): AdminBooking | null {
  const source = record(value);
  const id = text(source.id);
  const dateTime = dateText(source.date_time);
  const createdAt = dateText(source.created_at);
  const status = bookingStatus(source.status);
  if (!id || !dateTime || !createdAt || !status) return null;
  return {
    id,
    customer_name: text(source.customer_name) ?? "Unassigned customer",
    email: text(source.email),
    phone: text(source.phone),
    service: text(source.service),
    date_time: dateTime,
    status,
    notes: text(source.notes),
    created_at: createdAt,
    business_name: text(source.business_name),
    industry: text(source.industry),
  };
}

export function normalizeAdminDashboard(value: unknown): AdminDashboard {
  const source = record(value);
  const metrics = record(source.metrics);
  const bookings = record(source.bookings ?? metrics.bookings);
  const leads = record(source.leads ?? metrics.leads);
  const recentLeads = Array.isArray(source.recent_leads)
    ? source.recent_leads.map(normalizeLead).filter((lead): lead is AdminLead => lead !== null)
    : [];

  return {
    bookings: {
      total: numberValue(bookings.total),
      pending: numberValue(bookings.pending),
      confirmed: numberValue(bookings.confirmed),
      rejected: numberValue(bookings.rejected),
      cancelled: numberValue(bookings.cancelled),
    },
    leads: {
      total: numberValue(leads.total ?? source.total_leads),
      new: numberValue(leads.new),
      converted: numberValue(leads.converted ?? source.converted_leads),
      estimated_revenue: numberValue(leads.estimated_revenue ?? source.revenue),
      conversion_rate: numberValue(leads.conversion_rate ?? source.conversion_rate),
    },
    recent_leads: recentLeads,
  };
}

export function normalizeAdminBookingList(
  value: unknown,
  defaults: { limit: number; offset: number },
): AdminBookingList {
  const source = record(value);
  const items = Array.isArray(source.items)
    ? source.items.map(normalizeBooking).filter((booking): booking is AdminBooking => booking !== null)
    : [];
  return {
    items,
    total: numberValue(source.total, items.length),
    limit: numberValue(source.limit, defaults.limit),
    offset: numberValue(source.offset, defaults.offset),
  };
}

export function normalizeAdminLeadList(
  value: unknown,
  defaults: { limit: number; offset: number },
): AdminLeadList {
  const source = record(value);
  const items = Array.isArray(source.items)
    ? source.items.map(normalizeLead).filter((lead): lead is AdminLead => lead !== null)
    : [];
  return {
    items,
    total: numberValue(source.total, items.length),
    limit: numberValue(source.limit, defaults.limit),
    offset: numberValue(source.offset, defaults.offset),
  };
}

export function normalizeAdminBooking(value: unknown) {
  return normalizeBooking(value);
}

export function normalizeAdminLead(value: unknown) {
  return normalizeLead(value);
}
