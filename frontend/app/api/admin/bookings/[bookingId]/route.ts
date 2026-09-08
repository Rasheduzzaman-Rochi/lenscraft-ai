import { NextResponse } from "next/server";

import { AdminBackendError, getAdminBooking } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
  try {
    return NextResponse.json(await getAdminBooking((await context.params).bookingId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof AdminBackendError ? error.status : 503;
    return NextResponse.json(
      { message: status === 404 ? "Booking not found." : "Booking data is temporarily unavailable." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}