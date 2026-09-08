import { NextResponse } from "next/server";

import { adminConnectionMessage, adminProxyStatus, getAdminBooking } from "@/lib/admin/backend";
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
    const status = adminProxyStatus(error, [404]);
    return NextResponse.json(
      { message: status === 404 ? "Booking not found." : adminConnectionMessage(error) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
