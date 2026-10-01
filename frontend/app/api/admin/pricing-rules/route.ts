import { adminRoute, readBody } from "@/lib/admin/route";
import { createAdminPricingRule } from "@/lib/admin/records";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return adminRoute(
    async () => createAdminPricingRule(await readBody(request)),
    { notFound: "Service not found." },
    201,
  );
}
