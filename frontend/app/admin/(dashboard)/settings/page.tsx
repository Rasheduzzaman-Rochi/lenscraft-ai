import { ShieldCheck } from "lucide-react";

import { AdminSettingsActions } from "@/components/admin/admin-settings-actions";
import { CompanySettingsForm } from "@/components/admin/company-settings-form";
import { ErrorPanel, PageHeader, Panel } from "@/components/admin/ui";
import { AdminBackendError, adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminCompanySettings, getAdminServices } from "@/lib/admin/records";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const [{ data }, settingsResult, serviceNames] = await Promise.all([
    supabase.auth.getUser(),
    getAdminCompanySettings().then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminServices({ active: true, limit: 100 }).then((list) => list.items.map((service) => service.name)).catch(() => []),
  ]);
  const user = data.user;
  const notConfigured = "error" in settingsResult && settingsResult.error instanceof AdminBackendError && settingsResult.error.status === 404;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Workspace" title="Settings." description="Studio operating settings, your administration profile, and session." />

      {"value" in settingsResult ? (
        <Panel eyebrow="Studio settings" title="Operations" className="mt-8">
          <div className="mt-6"><CompanySettingsForm settings={settingsResult.value} serviceNames={serviceNames} /></div>
        </Panel>
      ) : (
        <ErrorPanel
          title={notConfigured ? "Studio settings are not configured." : "Studio settings could not be loaded."}
          message={notConfigured ? "No company settings record exists for this studio. Create it in Supabase before editing it here." : adminConnectionMessage(settingsResult.error)}
          retry={!notConfigured}
        />
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section className="border border-ink/10 bg-paper p-7"><ShieldCheck className="h-5 w-5 text-bronze" /><p className="eyebrow mt-8">Admin profile</p><h2 className="mt-3 break-words font-serif text-2xl">{user?.email ?? "Authenticated admin"}</h2><p className="mt-4 inline-flex items-center gap-2 bg-[#dce8db] px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#39523a]">Admin role verified</p></section>
        <section className="border border-ink/10 bg-paper p-7"><p className="eyebrow">System information</p><dl className="mt-6 space-y-5 text-sm"><div><dt className="eyebrow">Authentication</dt><dd className="mt-2 text-ink/60">Supabase Auth</dd></div><div><dt className="eyebrow">Company</dt><dd className="mt-2 text-ink/60">LensCraft Studio</dd></div><div><dt className="eyebrow">Session</dt><dd className="mt-2 text-ink/60">Secure server-managed cookies</dd></div></dl></section>
      </div>
      <section className="mt-6 border border-ink/10 bg-paper p-7"><p className="eyebrow">Account</p><p className="mt-3 max-w-xl text-sm leading-6 text-ink/55">Signing out clears the current Supabase session on this device.</p><AdminSettingsActions /></section>
    </div>
  );
}
