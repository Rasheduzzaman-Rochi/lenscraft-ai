import { NextResponse } from "next/server";

import { adminConnectionMessage, adminProxyStatus, getAdminLeads } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  try {
    const search = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Number(search.get("limit") ?? 50), 1), 100);
    const offset = Math.max(Number(search.get("offset") ?? 0), 0);
    return NextResponse.json(await getAdminLeads({ limit, offset }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = adminProxyStatus(error);
    return NextResponse.json({ message: adminConnectionMessage(error) }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
