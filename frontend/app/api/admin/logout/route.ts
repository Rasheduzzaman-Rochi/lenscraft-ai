import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, hasAdminSession } from "@/lib/admin/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) throw new Error();
    } catch {
      return NextResponse.json({ message: "Logout request was not accepted." }, { status: 403 });
    }
  }
  if (!(await hasAdminSession())) {
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { ...adminSessionCookieOptions, maxAge: 0 });
  return response;
}
