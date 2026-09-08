import { NextResponse } from "next/server";

import { adminConnectionMessage, adminProxyStatus, getAdminDashboard } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";

export const runtime = "nodejs";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json(
      { message: "Your admin session has expired." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const dashboard = await getAdminDashboard();
    return NextResponse.json(dashboard, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = adminProxyStatus(error);
    return NextResponse.json(
      { message: adminConnectionMessage(error) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
