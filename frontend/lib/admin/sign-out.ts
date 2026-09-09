import { createClient } from "@/lib/supabase/client";

export async function signOutAdmin() {
  const response = await fetch("/api/admin/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("The server could not end the admin session.");
  }

  const { error } = await createClient().auth.signOut();
  if (error) {
    throw new Error("Supabase could not clear the local session.");
  }
}
