"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOutAdmin } from "@/lib/admin/sign-out";

export function AdminSettingsActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function logout() {
    setBusy(true);
    setError(undefined);
    try {
      await signOutAdmin();
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("We could not sign you out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={logout} disabled={busy} className="mt-6 inline-flex items-center gap-2 border border-ink/15 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] transition hover:border-ink/40 disabled:opacity-50"><LogOut className="h-3.5 w-3.5" /> {busy ? "Signing out" : "Sign out"}</button>
      {error ? <p role="alert" className="mt-3 text-xs text-[#85483f]">{error}</p> : null}
    </div>
  );
}
