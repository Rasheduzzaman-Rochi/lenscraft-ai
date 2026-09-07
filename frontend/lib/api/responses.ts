import { NextResponse } from "next/server";

import { ApiConfigurationError, BackendApiError } from "@/lib/api/server";
import { RequestValidationError } from "@/lib/api/validation";

export function successResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function safeErrorResponse(
  error: unknown,
  messages: { invalid: string; unavailable: string; conflict?: string },
) {
  if (error instanceof RequestValidationError) {
    return successResponse({ message: messages.invalid }, 400);
  }
  if (error instanceof BackendApiError && error.status === 409 && messages.conflict) {
    return successResponse({ message: messages.conflict }, 409);
  }
  if (error instanceof BackendApiError && error.status === 422) {
    return successResponse({ message: messages.invalid }, 422);
  }
  if (error instanceof BackendApiError || error instanceof ApiConfigurationError) {
    return successResponse({ message: messages.unavailable }, 503);
  }
  return successResponse({ message: messages.unavailable }, 500);
}
