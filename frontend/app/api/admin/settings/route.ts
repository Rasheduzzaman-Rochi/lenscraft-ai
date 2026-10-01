import { adminRoute, readBody } from "@/lib/admin/route";
import { updateAdminCompanySettings } from "@/lib/admin/records";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  return adminRoute(
    async () => updateAdminCompanySettings(await readBody(request, 48_000)),
    { notFound: "Company settings are not configured." },
  );
}
