"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

type Method = "POST" | "PATCH" | "DELETE";

/**
 * Send one admin mutation at a time. Form state is owned by the caller, so a failed save keeps
 * every entered value; only a friendly server message is surfaced.
 */
export function useAdminMutation() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const run = useCallback(async <T,>(
    url: string,
    method: Method,
    body: unknown,
    options: { success: string; fallbackError: string; redirect?: (result: T) => string | undefined },
  ): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: body === undefined
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { message?: unknown } | null;
      if (!response.ok) {
        setError(typeof payload?.message === "string" ? payload.message : options.fallbackError);
        return undefined;
      }
      setSuccess(options.success);
      const destination = options.redirect?.(payload as T);
      if (destination) router.push(destination);
      router.refresh();
      return payload as T;
    } catch {
      setError(`${options.fallbackError} Check your connection and try again.`);
      return undefined;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [router]);

  return { busy, error, success, run, setError, clearSuccess: () => setSuccess(undefined) };
}
