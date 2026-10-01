import { adminRoute, readBody, recordId, type RecordContext } from "@/lib/admin/route";
import { updateAdminCustomer } from "@/lib/admin/records";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RecordContext) {
  return adminRoute(
    async () => updateAdminCustomer(await recordId(context), await readBody(request)),
    { notFound: "Customer not found." },
  );
}
