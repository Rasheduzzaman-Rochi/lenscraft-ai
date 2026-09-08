import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { authCookieOptions } from "@/lib/supabase/cookie-options";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    response.headers.set("Cache-Control", "private, no-store");
    return { response, user: null, isAdmin: false };
  }

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  if (error || !data.user) return { response, user: null, isAdmin: false };

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  return {
    response,
    user: data.user,
    isAdmin: !adminError && adminUser?.role === "admin",
  };
}
