"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminSettingsActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); await fetch("/api/admin/logout", { method: "POST" }).catch(() => null); router.replace("/admin/login"); router.refresh(); }
  return <button type="button" onClick={logout} disabled={busy} className="mt-6 inline-flex items-center gap-2 border border-ink/15 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] transition hover:border-ink/40 disabled:opacity-50"><LogOut className="h-3.5 w-3.5" /> {busy ? "Signing out" : "Sign out"}</button>;
}