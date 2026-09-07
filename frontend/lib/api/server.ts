import "server-only";

import { createHmac, randomUUID } from "node:crypto";

const REQUEST_TIMEOUT_MS = 12_000;

export class BackendApiError extends Error {
  constructor(public readonly status: number) {
    super("Backend API request failed");
    this.name = "BackendApiError";
  }
}

export class ApiConfigurationError extends Error {
  constructor() {
    super("Frontend API bridge is not configured");
    this.name = "ApiConfigurationError";
  }
}

function backendConfiguration() {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const retellApiKey = process.env.RETELL_API_KEY?.trim();
  const companyId = process.env.LENSCRAFT_COMPANY_ID?.trim();
  if (!rawUrl || !retellApiKey || !companyId) throw new ApiConfigurationError();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
    throw new ApiConfigurationError();
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(rawUrl);
  } catch {
    throw new ApiConfigurationError();
  }
  if (!["http:", "https:"].includes(apiUrl.protocol)) throw new ApiConfigurationError();
  return { apiUrl: apiUrl.toString().replace(/\/$/, ""), retellApiKey, companyId };
}

export function createRequestId(prefix: "contact" | "booking") {
  return `${prefix}-${randomUUID()}`;
}

export async function callBackendTool<T>(
  tool: "create-lead" | "create-booking" | "check-booking-availability",
  argumentsWithoutCompany: Record<string, unknown>,
): Promise<T> {
  const { apiUrl, retellApiKey, companyId } = backendConfiguration();
  const body = JSON.stringify({ company_id: companyId, ...argumentsWithoutCompany });
  const timestamp = Date.now().toString();
  const digest = createHmac("sha256", retellApiKey)
    .update(body)
    .update(timestamp)
    .digest("hex");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/tools/${tool}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Retell-Signature": `v=${timestamp},d=${digest}`,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new BackendApiError(503);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new BackendApiError(response.status);
  return payload as T;
}
