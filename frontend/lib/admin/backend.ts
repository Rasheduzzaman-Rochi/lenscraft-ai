import "server-only";

import type { AdminBooking, AdminBookingList, AdminDashboard, AdminLead, AdminLeadList, AdminLeadStatus, BookingStatus } from "@/lib/admin/types";

const REQUEST_TIMEOUT_MS = 12_000;

export class AdminBackendError extends Error {
  constructor(public readonly status: number, public readonly detail?: string) {
    super("Admin backend request failed");
    this.name = "AdminBackendError";
  }
}

function configuration() {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  const companyId = process.env.LENSCRAFT_COMPANY_ID?.trim();

  if (!rawUrl || !apiKey || !companyId) {
    console.warn("[admin-backend] incomplete configuration", {
      hasApiUrl: Boolean(rawUrl),
      hasAdminApiKey: Boolean(apiKey),
      hasCompanyId: Boolean(companyId),
    });
    throw new AdminBackendError(503, "Admin API configuration is incomplete.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
    throw new AdminBackendError(503, "Admin API configuration is invalid.");
  }

  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return { apiUrl: url.toString().replace(/\/$/, ""), apiKey, companyId };
  } catch {
    console.warn("[admin-backend] invalid API URL configuration");
    throw new AdminBackendError(503, "Admin API is unavailable.");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiUrl, apiKey } = configuration();
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "X-Admin-API-Key": apiKey,
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    console.warn("[admin-backend] request failed", { path });
    throw new AdminBackendError(503);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
      ? payload.detail
      : payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : undefined;
    console.warn("[admin-backend] upstream request rejected", {
      path,
      status: response.status,
      detail,
    });
    throw new AdminBackendError(response.status, detail);
  }
  return payload as T;
}

export function getAdminDashboard() {
  return request<AdminDashboard>("/api/v1/admin/dashboard");
}

export function getAdminBookings(options: { status?: BookingStatus; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });
  if (options.status) query.set("status", options.status);
  return request<AdminBookingList>(`/api/v1/admin/bookings?${query}`);
}

export function updateAdminBookingStatus(bookingId: string, status: Exclude<BookingStatus, "pending">) {
  const { companyId } = configuration();
  return request<{ booking_id: string; status: BookingStatus; message: string }>(
    `/api/v1/bookings/${encodeURIComponent(bookingId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId, status }),
    },
  );
}

export function getAdminBooking(bookingId: string) {
  return request<AdminBooking>(`/api/v1/admin/bookings/${encodeURIComponent(bookingId)}`);
}

export function getAdminLeads(options: { limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });
  return request<AdminLeadList>(`/api/v1/admin/leads?${query}`);
}

export function getAdminLead(leadId: string) {
  return request<AdminLead>(`/api/v1/admin/leads/${encodeURIComponent(leadId)}`);
}

export function updateAdminLeadStatus(leadId: string, status: AdminLeadStatus) {
  return request<AdminLead>(`/api/admin/leads/${encodeURIComponent(leadId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function createAdminBooking(payload: {
  customer: { name: string; email?: string; phone?: string; business_name?: string; industry?: string };
  date_time: string;
  service_type: string;
  notes?: string;
}) {
  return request<{ customer_id: string; booking_id: string; status: BookingStatus; message: string }>("/api/admin/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
