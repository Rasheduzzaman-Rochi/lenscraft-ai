import { callBackendTool, createRequestId } from "@/lib/api/server";
import { safeErrorResponse, successResponse } from "@/lib/api/responses";
import {
  emailAddress,
  optionalText,
  readJsonObject,
  requiredText,
} from "@/lib/api/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const data = await readJsonObject(request);
    const name = requiredText(data, "name", 500);
    const email = emailAddress(data);
    const phone = optionalText(data, "phone", 50);
    const company = optionalText(data, "company", 500);
    const projectType = requiredText(data, "projectType", 500);
    const message = requiredText(data, "message", 1_000);

    const result = await callBackendTool<{ success?: unknown }>("create-lead", {
      request_id: createRequestId("contact"),
      customer: {
        name,
        email,
        phone,
        business_name: company,
      },
      lead: {
        source: "website",
        intent: message,
        status: "new",
      },
      project: {
        service_type: projectType,
        status: "draft",
      },
    });
    if (result.success !== true) throw new Error("Unexpected lead response");

    return successResponse({
      success: true,
      message: "Thank you. Our team will review your project and contact you shortly.",
    }, 201);
  } catch (error) {
    return safeErrorResponse(error, {
      invalid: "Please review your details and try again.",
      unavailable: "Our enquiry service is temporarily unavailable. Please try again shortly.",
    });
  }
}
