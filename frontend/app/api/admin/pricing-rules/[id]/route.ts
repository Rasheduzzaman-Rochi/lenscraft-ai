import { adminRoute, readBody, recordId, type RecordContext } from "@/lib/admin/route";
import { deleteAdminPricingRule, updateAdminPricingRule } from "@/lib/admin/records";

export const runtime = "nodejs";

const messages = { notFound: "Pricing rule not found." };

export async function PATCH(request: Request, context: RecordContext) {
  return adminRoute(async () => updateAdminPricingRule(await recordId(context), await readBody(request)), messages);
}

export async function DELETE(_request: Request, context: RecordContext) {
  return adminRoute(async () => deleteAdminPricingRule(await recordId(context)), messages);
}
