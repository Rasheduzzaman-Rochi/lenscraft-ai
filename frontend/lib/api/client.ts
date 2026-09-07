import type {
  AvailabilityResult,
  BookingSubmission,
  ContactSubmission,
  SubmissionResult,
} from "@/lib/api/types";

export class ClientApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

async function request<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClientApiError(0, "We could not reach the studio. Please try again.");
  }

  const payload = await response.json().catch(() => null) as { message?: unknown } | null;
  if (!response.ok) {
    const message = typeof payload?.message === "string"
      ? payload.message
      : "Something went wrong. Please try again.";
    throw new ClientApiError(response.status, message);
  }
  return payload as T;
}

export function submitContact(data: ContactSubmission) {
  return request<SubmissionResult>("/api/contact", data);
}

export function checkBookingAvailability(dateTime: string) {
  return request<AvailabilityResult>("/api/booking/availability", { dateTime });
}

export function submitBooking(data: BookingSubmission) {
  return request<SubmissionResult>("/api/booking", data);
}
