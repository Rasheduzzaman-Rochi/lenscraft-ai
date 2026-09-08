import { createBrowserClient } from "@supabase/ssr";

import { authCookieOptions } from "@/lib/supabase/cookie-options";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("Supabase authentication is not configured");
  }
  return createBrowserClient(url, anonKey, { cookieOptions: authCookieOptions });
}
