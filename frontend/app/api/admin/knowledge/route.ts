import { adminRoute, readBody } from "@/lib/admin/route";
import { createAdminKnowledge } from "@/lib/admin/records";

export const runtime = "nodejs";

const KNOWLEDGE_BODY_LIMIT = 900_000;

export async function POST(request: Request) {
  return adminRoute(
    async () => createAdminKnowledge(await readBody(request, KNOWLEDGE_BODY_LIMIT)),
    { notFound: "Knowledge document not found." },
    201,
  );
}
