export class RequestValidationError extends Error {
  constructor() {
    super("Invalid request");
    this.name = "RequestValidationError";
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new RequestValidationError();
  }
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > 24_000) {
    throw new RequestValidationError();
  }
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new RequestValidationError();
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    throw new RequestValidationError();
  }
}

export function requiredText(
  data: Record<string, unknown>,
  key: string,
  maximum: number,
): string {
  const value = data[key];
  if (typeof value !== "string") throw new RequestValidationError();
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new RequestValidationError();
  return normalized;
}

export function optionalText(
  data: Record<string, unknown>,
  key: string,
  maximum: number,
): string | undefined {
  const value = data[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new RequestValidationError();
  const normalized = value.trim();
  if (normalized.length > maximum) throw new RequestValidationError();
  return normalized || undefined;
}

export function emailAddress(data: Record<string, unknown>, key = "email"): string {
  const email = requiredText(data, key, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestValidationError();
  return email;
}

export function awareDateTime(data: Record<string, unknown>, key = "dateTime"): string {
  const value = requiredText(data, key, 40);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new RequestValidationError();
  }
  return value;
}
