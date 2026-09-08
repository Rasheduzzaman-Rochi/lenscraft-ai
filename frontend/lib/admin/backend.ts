import "server-only";

import {
  normalizeAdminBooking,
  normalizeAdminBookingList,
  normalizeAdminDashboard,
  normalizeAdminLead,
  normalizeAdminLeadList,
} from "@/lib/admin/normalize";
import type { AdminLead, AdminLeadStatus, BookingStatus } from "@/lib/admin/types";

const REQUEST_TIMEOUT_MS = 12_000;
let loggedConfigurationState: string | undefined;

export class AdminBackendError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: "configuration" | "network" | "upstream-configuration" | "upstream-auth" | "upstream" | "invalid-response",
  ) {
    super("Admin backend request failed");
    this.name = "AdminBackendError";
  }
}

function configuration() {
  const runtimeApiUrlKey = "NEXT_PUBLIC_API_URL";
  const rawUrl = process.env[runtimeApiUrlKey]?.trim();
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  const companyId = process.env.LENSCRAFT_COMPANY_ID?.trim();
  const state = {
    hasApiUrl: Boolean(rawUrl),
    hasAdminApiKey: Boolean(apiKey),
    hasCompanyId: Boolean(companyId),
  };
  const serializedState = JSON.stringify(state);
  if (serializedState !== loggedConfigurationState) {
    console.info("[admin-backend] config", state);
    loggedConfigurationState = serializedState;
  }

  if (!rawUrl || !apiKey || !companyId) {
    throw new AdminBackendError(503, "configuration");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
    console.warn("[admin-backend] company configuration is invalid");
    throw new AdminBackendError(503, "configuration");
  }

  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return { apiUrl: url.toString().replace(/\/$/, ""), apiKey, companyId };
  } catch {
    console.warn("[admin-backend] invalid API URL configuration");
    throw new AdminBackendError(503, "configuration");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiUrl, apiKey } = configuration();
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    headers.set("X-Admin-API-Key", apiKey);
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    console.warn("[admin-backend] request failed", { path });
    throw new AdminBackendError(503, "network");
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
      hasDetail: Boolean(detail),
    });
    const configurationDetails = new Set([
      "Admin API authentication is not configured.",
      "Admin company is not configured.",
      "Admin database is not configured.",
    ]);
    const code = response.status === 503 && detail && configurationDetails.has(detail)
      ? "upstream-configuration"
      : response.status === 401 || response.status === 403
        ? "upstream-auth"
        : "upstream";
    throw new AdminBackendError(response.status, code);
  }
  return payload as T;
}

export function getAdminDashboard() {
  return request<unknown>("/api/v1/admin/dashboard").then(normalizeAdminDashboard);
}

export function getAdminBookings(options: { status?: BookingStatus; limit?: number; offset?: number } = {}) {
  const defaults = { limit: options.limit ?? 50, offset: options.offset ?? 0 };
  const query = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });
  if (options.status) query.set("status", options.status);
  return request<unknown>(`/api/v1/admin/bookings?${query}`)
    .then((value) => normalizeAdminBookingList(value, defaults));
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
  return request<unknown>(`/api/v1/admin/bookings/${encodeURIComponent(bookingId)}`)
    .then((value) => {
      const booking = normalizeAdminBooking(value);
      if (!booking) throw new AdminBackendError(502, "invalid-response");
      return booking;
    });
}

export function getAdminLeads(options: { limit?: number; offset?: number } = {}) {
  const defaults = { limit: options.limit ?? 50, offset: options.offset ?? 0 };
  const query = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });
  return request<unknown>(`/api/v1/admin/leads?${query}`)
    .then((value) => normalizeAdminLeadList(value, defaults));
}

export function getAdminLead(leadId: string) {
  return request<unknown>(`/api/v1/admin/leads/${encodeURIComponent(leadId)}`)
    .then((value) => {
      const lead = normalizeAdminLead(value);
      if (!lead) throw new AdminBackendError(502, "invalid-response");
      return lead;
    });
}

export function updateAdminLeadStatus(leadId: string, status: AdminLeadStatus) {
  return request<AdminLead>(`/api/v1/admin/leads/${encodeURIComponent(leadId)}/status`, {
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
  return request<{ customer_id: string; booking_id: string; status: BookingStatus; message: string }>("/api/v1/admin/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function adminProxyStatus(error: unknown, passthrough: readonly number[] = []) {
  if (!(error instanceof AdminBackendError)) return 503;
  if (error.code === "upstream" && passthrough.includes(error.status)) return error.status;
  return 503;
}

export function isAdminConfigurationError(error: unknown) {
  return error instanceof AdminBackendError && (
    error.code === "configuration" || error.code === "upstream-configuration"
  );
}

export function adminConnectionMessage(error: unknown) {
  if (!(error instanceof AdminBackendError)) {
    return "The studio connection did not respond. Please try again.";
  }
  if (error.code === "configuration") {
    return "The frontend server admin connection is not configured.";
  }
  if (error.code === "upstream-configuration") {
    return "The FastAPI admin connection is not configured in the deployment.";
  }
  if (error.code === "upstream-auth") {
    return "The frontend and FastAPI admin credentials do not match.";
  }
  return "The studio connection did not respond. Please try again.";
}
