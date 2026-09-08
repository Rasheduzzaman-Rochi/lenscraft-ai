import { NextResponse, type NextRequest } from "next/server";

import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user, isAdmin } = await updateSupabaseSession(request);
  const isLogin = request.nextUrl.pathname === "/admin/login";
  const isAdminApi = request.nextUrl.pathname.startsWith("/api/admin/");
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin/") || request.nextUrl.pathname === "/admin";

  if (!user && !isLogin && (isAdminPage || isAdminApi)) {
    if (isAdminApi) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (user && !isAdmin && !isLogin && (isAdminPage || isAdminApi)) {
    if (isAdminApi) {
      return NextResponse.json({ message: "Admin access required." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/admin/login?error=not-admin", request.url));
  }

  if (user && isAdmin && isLogin) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
