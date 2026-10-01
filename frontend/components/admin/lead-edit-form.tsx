"use client";

import { FormEvent, useState } from "react";

import { AdminField, FormFeedback, SubmitButton } from "@/components/admin/form-parts";
import { adminInputClass } from "@/components/admin/ui";
import { useAdminMutation } from "@/components/admin/use-admin-mutation";
import type { AdminLead } from "@/lib/admin/types";

const AMOUNT = /^\d{1,14}(\.\d{1,4})?$/;

export function LeadEditForm({ lead, currency }: { lead: AdminLead; currency: string }) {
  const [intent, setIntent] = useState(lead.intent ?? "");
  const [source, setSource] = useState(lead.source ?? "");
  const [value, setValue] = useState(lead.estimated_value == null ? "" : String(lead.estimated_value));
  const { busy, error, success, run, setError } = useAdminMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead.updated_at) {
      setError("Reload the page before editing this lead.");
      return;
    }
    const amount = value.trim();
    if (amount && !AMOUNT.test(amount)) {
      setError("Estimated value must be a positive amount with at most 4 decimals.");
      return;
    }
    const body: Record<string, string | null> = {};
    if (intent !== (lead.intent ?? "")) body.intent = intent.trim() || null;
    if (source !== (lead.source ?? "")) body.source = source.trim() || null;
    if (amount !== (lead.estimated_value == null ? "" : String(lead.estimated_value))) body.estimated_value = amount || null;
    await run(`/api/admin/leads/${lead.id}`, "PATCH", { ...body, expected_updated_at: lead.updated_at }, {
      success: Object.keys(body).length ? "Lead saved." : "No changes to save.",
      fallbackError: "The lead could not be saved.",
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <AdminField label="Intent / requirements" htmlFor="lead-intent" className="sm:col-span-2">
          <textarea id="lead-intent" value={intent} onChange={(event) => setIntent(event.target.value)} maxLength={1000} rows={4} className={`${adminInputClass} h-auto py-3`} />
        </AdminField>
        <AdminField label="Source" htmlFor="lead-source" hint="Where the enquiry came from, for example retell or website.">
          <input id="lead-source" value={source} onChange={(event) => setSource(event.target.value)} maxLength={100} className={adminInputClass} />
        </AdminField>
        <AdminField label={`Estimated value (${currency})`} htmlFor="lead-value">
          <input id="lead-value" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} className={adminInputClass} />
        </AdminField>
      </div>
      <div className="flex flex-col gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <FormFeedback error={error} success={success} />
        <SubmitButton busy={busy} label="Save lead" busyLabel="Saving" />
      </div>
    </form>
  );
}
