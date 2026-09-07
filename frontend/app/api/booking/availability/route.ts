import { safeErrorResponse, successResponse } from "@/lib/api/responses";
import { callBackendTool } from "@/lib/api/server";
import { awareDateTime, readJsonObject } from "@/lib/api/validation";

export const runtime = "nodejs";

type BackendAvailability = {
  available?: unknown;
  pending_conflict?: unknown;
};

export async function POST(request: Request) {
  try {
    const data = await readJsonObject(request);
    const dateTime = awareDateTime(data);
    const result = await callBackendTool<BackendAvailability>(
      "check-booking-availability",
      { date_time: dateTime },
    );
    if (typeof result.available !== "boolean") throw new Error("Unexpected availability response");

    return successResponse({
      available: result.available,
      ...(result.pending_conflict === true ? { pendingConflict: true } : {}),
      message: result.available
        ? result.pending_conflict === true
          ? "This time has another pending request, but you may still submit yours."
          : "This time is available to request."
        : "That time is unavailable. Please choose another date or time.",
    });
  } catch (error) {
    return safeErrorResponse(error, {
      invalid: "Please choose a valid date and time.",
      unavailable: "We could not check that time right now. Please try again shortly.",
    });
  }
}
