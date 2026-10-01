import { adminRoute, readBody, recordId, type RecordContext } from "@/lib/admin/route";
import { updateAdminProject } from "@/lib/admin/records";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RecordContext) {
  return adminRoute(
    async () => updateAdminProject(await recordId(context), await readBody(request)),
    { notFound: "Project not found." },
  );
}
