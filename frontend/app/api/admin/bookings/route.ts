import { NextResponse } from "next/server";

import { AdminBackendError, createAdminBooking, getAdminBookings } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import type { BookingStatus } from "@/lib/admin/types";
import { readJsonObject } from "@/lib/api/validation";

export const runtime = "nodejs";

const bookingStatuses = new Set<BookingStatus>(["pending", "confirmed", "rejected", "cancelled"]);

function integerParameter(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new Error("Invalid integer parameter");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error("Integer parameter is outside its allowed range");
  return parsed;
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  try {
    return NextResponse.json(await createAdminBooking(await readJsonObject(request) as Parameters<typeof createAdminBooking>[0]), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AdminBackendError ? error.status : 422;
    return NextResponse.json({ message: status === 409 ? "Booking could not be created with these details." : "Booking details are invalid." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json(
      { message: "Your admin session has expired." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const search = new URL(request.url).searchParams;
    const rawStatus = search.get("status");
    if (rawStatus !== null && !bookingStatuses.has(rawStatus as BookingStatus)) {
      throw new Error("Invalid booking status");
    }
    const bookings = await getAdminBookings({
      status: rawStatus as BookingStatus | undefined,
      limit: integerParameter(search.get("limit"), 50, 1, 100),
      offset: integerParameter(search.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER),
    });
    return NextResponse.json(bookings, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AdminBackendError) {
      return NextResponse.json(
        { message: "Booking data is temporarily unavailable." },
        { status: error.status === 401 ? 401 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { message: "The booking filters are invalid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
