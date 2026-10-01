import { adminRoute, readBody, recordId, type RecordContext } from "@/lib/admin/route";
import { deleteAdminKnowledge, updateAdminKnowledge } from "@/lib/admin/records";

export const runtime = "nodejs";

const messages = { notFound: "Knowledge document not found." };

export async function PATCH(request: Request, context: RecordContext) {
  return adminRoute(
    async () => updateAdminKnowledge(await recordId(context), await readBody(request, 900_000)),
    messages,
  );
}

export async function DELETE(_request: Request, context: RecordContext) {
  return adminRoute(async () => deleteAdminKnowledge(await recordId(context)), messages);
}
