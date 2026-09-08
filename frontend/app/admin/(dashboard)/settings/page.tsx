import { ShieldCheck } from "lucide-react";

import { AdminSettingsActions } from "@/components/admin/admin-settings-actions";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return <div className="mx-auto max-w-4xl"><div className="border-b border-ink/10 pb-9"><p className="eyebrow">Workspace</p><h1 className="mt-3 font-serif text-5xl tracking-[-0.03em] sm:text-6xl">Settings.</h1><p className="mt-4 text-sm text-ink/50">Your studio administration profile and system connection.</p></div><div className="mt-8 grid gap-6 sm:grid-cols-2"><section className="border border-ink/10 bg-paper p-7"><ShieldCheck className="h-5 w-5 text-bronze" /><p className="eyebrow mt-8">Admin profile</p><h2 className="mt-3 font-serif text-2xl">{user?.email ?? "Authenticated admin"}</h2><p className="mt-4 inline-flex items-center gap-2 bg-[#dce8db] px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#39523a]">Admin role verified</p></section><section className="border border-ink/10 bg-paper p-7"><p className="eyebrow">System information</p><dl className="mt-6 space-y-5 text-sm"><div><dt className="eyebrow">Authentication</dt><dd className="mt-2 text-ink/60">Supabase Auth</dd></div><div><dt className="eyebrow">Company</dt><dd className="mt-2 text-ink/60">LensCraft Studio</dd></div><div><dt className="eyebrow">Session</dt><dd className="mt-2 text-ink/60">Secure server-managed cookies</dd></div></dl></section></div><section className="mt-6 border border-ink/10 bg-paper p-7"><p className="eyebrow">Account</p><p className="mt-3 max-w-xl text-sm leading-6 text-ink/55">Signing out clears the current Supabase session on this device.</p><AdminSettingsActions /></section></div>;
}