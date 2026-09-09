import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("[admin-auth] sign out failed", { error: error.name });
      return NextResponse.json(
        { message: "The admin session could not be ended." },
        { status: 500, headers: { "Cache-Control": "private, no-store" } },
      );
    }
  } catch (error) {
    console.warn("[admin-auth] sign out failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { message: "The admin session could not be ended." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
