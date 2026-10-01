import "server-only";

import { NextResponse } from "next/server";

import { AdminBackendError, adminConnectionMessage } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import { readJsonObject, RequestValidationError } from "@/lib/api/validation";

const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

export type RecordContext = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Read a record id from the route, rejecting anything that is not a UUID before proxying. */
export async function recordId(context: RecordContext) {
  const { id } = await context.params;
  if (!RECORD_ID.test(id)) throw new RequestValidationError();
  return id;
}

/** Read a JSON object body. FastAPI schemas forbid unknown fields, including company_id. */
export function readBody(request: Request, maxBytes?: number) {
  return readJsonObject(request, maxBytes);
}

/**
 * Run a session-checked admin proxy operation and translate failures into safe messages.
 * Only sanitized FastAPI business-rule messages (404/409/422 with a string detail) reach the browser.
 */
export async function adminRoute(
  operation: () => Promise<unknown>,
  messages: { notFound: string; invalid?: string },
  successStatus = 200,
) {
  if (!(await hasAdminSession())) return json({ message: "Your admin session has expired." }, 401);
  try {
    return json(await operation(), successStatus);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return json({ message: messages.invalid ?? "The submitted details are invalid." }, 400);
    }
    if (error instanceof AdminBackendError && error.code === "upstream") {
      if (error.status === 404) return json({ message: messages.notFound }, 404);
      if (error.status === 409 || error.status === 422) {
        return json({
          message: error.detail ?? messages.invalid ?? "Some details are invalid. Check the form and try again.",
        }, error.status);
      }
    }
    return json({ message: adminConnectionMessage(error) }, 503);
  }
}
