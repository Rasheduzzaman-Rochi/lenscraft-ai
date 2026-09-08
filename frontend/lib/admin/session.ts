import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function hasAdminSession() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return false;

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    return !adminError && adminUser?.role === "admin";
  } catch (error) {
    console.warn("[admin-session] session check failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

export async function requireAdminSession() {
  if (!(await hasAdminSession())) redirect("/admin/login");
}
