import { NextResponse } from "next/server";

import { AdminBackendError, adminConnectionMessage, adminProxyStatus, updateAdminBookingStatus } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import type { BookingStatus } from "@/lib/admin/types";
import { readJsonObject, requiredText } from "@/lib/api/validation";

export const runtime = "nodejs";

const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set<BookingStatus>(["confirmed", "rejected", "cancelled"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "Your admin session has expired." }, { status: 401 });
  }

  try {
    const { bookingId } = await context.params;
    if (!BOOKING_ID.test(bookingId)) throw new Error("Invalid booking id");
    const body = await readJsonObject(request);
    const status = requiredText(body, "status", 20) as BookingStatus;
    if (!statuses.has(status)) throw new Error("Invalid status");

    const result = await updateAdminBookingStatus(
      bookingId,
      status as Exclude<BookingStatus, "pending">,
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminBackendError) {
      const status = adminProxyStatus(error, [404, 409, 422]);
      const message = status === 409
        ? "That time has already been confirmed for another booking."
        : status === 404 || status === 422
          ? "This booking can no longer be updated."
          : adminConnectionMessage(error);
      return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { message: "The booking update is invalid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
