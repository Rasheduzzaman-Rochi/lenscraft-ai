import { NextResponse } from "next/server";

import { AdminBackendError, adminConnectionMessage, adminProxyStatus, updateAdminLeadStatus } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import { readJsonObject, requiredText } from "@/lib/api/validation";
import type { AdminLeadStatus } from "@/lib/admin/types";

const statuses = new Set<AdminLeadStatus>(["new", "contacted", "qualified", "converted", "lost"]);

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  try {
    const body = await readJsonObject(request);
    const status = requiredText(body, "status", 20).toLowerCase() as AdminLeadStatus;
    if (!statuses.has(status)) return NextResponse.json({ message: "Invalid lead status." }, { status: 422 });
    return NextResponse.json(await updateAdminLeadStatus((await context.params).id, status), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AdminBackendError
      ? adminProxyStatus(error, [404, 422])
      : 400;
    const message = status === 404
      ? "Lead not found."
      : status === 503
        ? adminConnectionMessage(error)
        : "Lead status could not be updated.";
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
