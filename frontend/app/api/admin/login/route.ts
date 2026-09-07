import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  adminAuthenticationConfigured,
  adminSessionCookieOptions,
  createAdminSessionToken,
  verifyAdminCredential,
} from "@/lib/admin/session";
import { readJsonObject, requiredText } from "@/lib/api/validation";

export const runtime = "nodejs";

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1_000;
const MAX_ATTEMPTS = 8;

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Login request was not accepted." }, { status: 403 });
  }
  if (!adminAuthenticationConfigured()) {
    return NextResponse.json({ message: "Admin login is not configured." }, { status: 503 });
  }

  const key = clientKey(request);
  const now = Date.now();
  const previous = attempts.get(key);
  const current = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + ATTEMPT_WINDOW_MS }
    : previous;
  if (current.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonObject(request);
    const credential = requiredText(body, "credential", 1_024);
    if (!verifyAdminCredential(credential)) {
      attempts.set(key, { ...current, count: current.count + 1 });
      return NextResponse.json(
        { message: "The access credential is incorrect." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    attempts.delete(key);
    const response = NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), adminSessionCookieOptions);
    return response;
  } catch {
    return NextResponse.json(
      { message: "Enter a valid access credential." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
