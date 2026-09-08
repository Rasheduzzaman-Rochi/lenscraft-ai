import { NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin/session";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) throw new Error();
    } catch {
      return NextResponse.json({ message: "Logout request was not accepted." }, { status: 403 });
    }
  }
  if (await hasAdminSession()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
