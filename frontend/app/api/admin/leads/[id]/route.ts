import { NextResponse } from "next/server";

import { adminConnectionMessage, adminProxyStatus, deleteAdminLead, getAdminLead } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";

export const runtime = "nodejs";

const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await hasAdminSession())) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  try {
    return NextResponse.json(await getAdminLead((await context.params).id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = adminProxyStatus(error, [404]);
    return NextResponse.json({ message: status === 404 ? "Lead not found." : adminConnectionMessage(error) }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    if (!RECORD_ID.test(id)) {
      return NextResponse.json({ message: "Lead identifier is invalid." }, { status: 400 });
    }
    return NextResponse.json(await deleteAdminLead(id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = adminProxyStatus(error, [404, 409]);
    const message = status === 404
      ? "Lead not found."
      : status === 409
        ? "This lead cannot be deleted because it is still in use."
        : adminConnectionMessage(error);
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
