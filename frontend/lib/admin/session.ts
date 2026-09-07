import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_SESSION_COOKIE = "lenscraft_admin_session";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

function sessionSecret() {
  const value = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) return null;
  return value;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function adminAuthenticationConfigured() {
  return Boolean(
    process.env.ADMIN_LOGIN_PASSWORD?.trim() &&
    process.env.ADMIN_API_KEY?.trim() &&
    process.env.LENSCRAFT_COMPANY_ID?.trim() &&
    sessionSecret(),
  );
}

export function verifyAdminCredential(candidate: string) {
  const configured = process.env.ADMIN_LOGIN_PASSWORD?.trim();
  if (!configured || !sessionSecret()) return false;
  return timingSafeEqual(digest(candidate), digest(configured));
}

export function createAdminSessionToken(now = Date.now()) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Admin session is not configured");
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: now + ADMIN_SESSION_SECONDS * 1_000 }))
    .toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function validateAdminSessionToken(token: string | undefined, now = Date.now()) {
  const secret = sessionSecret();
  if (!secret || !token) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;

  const expectedSignature = createHmac("sha256", secret).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return false;
  }
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    return Boolean(
      parsed &&
      typeof parsed === "object" &&
      (parsed as { v?: unknown }).v === 1 &&
      typeof (parsed as { exp?: unknown }).exp === "number" &&
      (parsed as { exp: number }).exp > now,
    );
  } catch {
    return false;
  }
}

export async function hasAdminSession() {
  const store = await cookies();
  return validateAdminSessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession() {
  if (!(await hasAdminSession())) redirect("/admin/login");
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ADMIN_SESSION_SECONDS,
};
