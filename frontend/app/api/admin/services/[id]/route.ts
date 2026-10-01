import { adminRoute, readBody, recordId, type RecordContext } from "@/lib/admin/route";
import { deleteAdminService, updateAdminService } from "@/lib/admin/records";

export const runtime = "nodejs";

const messages = { notFound: "Service not found." };

export async function PATCH(request: Request, context: RecordContext) {
  return adminRoute(async () => updateAdminService(await recordId(context), await readBody(request)), messages);
}

export async function DELETE(_request: Request, context: RecordContext) {
  return adminRoute(async () => deleteAdminService(await recordId(context)), messages);
}
