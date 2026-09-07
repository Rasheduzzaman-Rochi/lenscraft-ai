import { safeErrorResponse, successResponse } from "@/lib/api/responses";
import { callBackendTool } from "@/lib/api/server";
import {
  awareDateTime,
  emailAddress,
  optionalText,
  readJsonObject,
  requiredText,
} from "@/lib/api/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const data = await readJsonObject(request);
    const dateTime = awareDateTime(data);
    const serviceType = requiredText(data, "serviceType", 500);
    const name = requiredText(data, "name", 500);
    const email = emailAddress(data);
    const phone = requiredText(data, "phone", 50);
    const company = optionalText(data, "company", 500);
    const notes = optionalText(data, "notes", 5_000);

    const result = await callBackendTool<{ success?: unknown }>("create-booking", {
      customer: {
        name,
        email,
        phone,
        business_name: company,
      },
      date_time: dateTime,
      service_type: serviceType,
      notes,
    });
    if (result.success !== true) throw new Error("Unexpected booking response");

    return successResponse({
      success: true,
      message: "Your booking request has been submitted and is pending confirmation from LensCraft Studio.",
    }, 201);
  } catch (error) {
    return safeErrorResponse(error, {
      invalid: "Please review your booking details and try again.",
      conflict: "That time is unavailable. Please choose another date or time.",
      unavailable: "Our booking service is temporarily unavailable. Please try again shortly.",
    });
  }
}
