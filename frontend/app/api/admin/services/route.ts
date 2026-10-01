import { adminRoute, readBody } from "@/lib/admin/route";
import { createAdminService } from "@/lib/admin/records";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return adminRoute(async () => createAdminService(await readBody(request)), { notFound: "Service not found." }, 201);
}
