import { NextResponse } from "next/server";

import { AdminBackendError, adminConnectionMessage, adminProxyStatus, updateAdminBookingStatus } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import type { BookingStatus } from "@/lib/admin/types";
import { readJsonObject, requiredText } from "@/lib/api/validation";

export const runtime = "nodejs";

const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedStatuses = new Set<Exclude<BookingStatus, "pending">>([
  "confirmed",
  "rejected",
  "cancelled",
]);

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { message: "Booking update was not accepted." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!(await hasAdminSession())) {
    return NextResponse.json(
      { message: "Your admin session has expired." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonObject(request);
    const bookingId = requiredText(body, "booking_id", 36);
    const status = requiredText(body, "status", 20) as BookingStatus;
    if (!BOOKING_ID.test(bookingId) || !allowedStatuses.has(
      status as Exclude<BookingStatus, "pending" | "cancelled">,
    )) {
      throw new Error("Invalid booking update");
    }

    const result = await updateAdminBookingStatus(
      bookingId,
      status as Exclude<BookingStatus, "pending">,
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AdminBackendError) {
      const status = adminProxyStatus(error, [404, 409, 422]);
      const message = status === 409
        ? "That time has already been confirmed for another booking."
        : status === 404 || status === 422
          ? "This booking can no longer be updated."
          : adminConnectionMessage(error);
      return NextResponse.json(
        { message },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { message: "The booking update is invalid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
