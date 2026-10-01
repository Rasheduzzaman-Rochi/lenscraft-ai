"use client";

import { FormEvent, useState } from "react";

import { AdminField, FormFeedback, SubmitButton } from "@/components/admin/form-parts";
import { adminInputClass } from "@/components/admin/ui";
import { useAdminMutation } from "@/components/admin/use-admin-mutation";
import type { AdminCustomer } from "@/lib/admin/types";

const fields = [
  { key: "name", label: "Name", type: "text", max: 500, required: true },
  { key: "email", label: "Email", type: "email", max: 320 },
  { key: "phone", label: "Phone", type: "tel", max: 50 },
  { key: "business_name", label: "Business name", type: "text", max: 500 },
  { key: "industry", label: "Industry", type: "text", max: 200 },
] as const;

type Key = (typeof fields)[number]["key"];

export function CustomerForm({ customer }: { customer: AdminCustomer }) {
  const [values, setValues] = useState<Record<Key, string>>(() => ({
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    business_name: customer.business_name ?? "",
    industry: customer.industry ?? "",
  }));
  const { busy, error, success, run } = useAdminMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: Record<string, string | null> = {};
    for (const { key } of fields) {
      const next = values[key].trim();
      const current = customer[key] ?? "";
      if (next !== current) body[key] = next || null;
    }
    await run(`/api/admin/customers/${customer.id}`, "PATCH", { ...body, expected_updated_at: customer.updated_at }, {
      success: Object.keys(body).length ? "Customer saved." : "No changes to save.",
      fallbackError: "The customer could not be saved.",
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {fields.map((field) => (
          <AdminField key={field.key} label={field.label} htmlFor={`customer-${field.key}`}>
            <input
              id={`customer-${field.key}`}
              type={field.type}
              value={values[field.key]}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              required={"required" in field}
              maxLength={field.max}
              autoComplete="off"
              className={adminInputClass}
            />
          </AdminField>
        ))}
      </div>
      <p className="text-xs leading-5 text-ink/45">The voice agent verifies booking-status callers by email or phone, so keep contact details accurate.</p>
      <div className="flex flex-col gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <FormFeedback error={error} success={success} />
        <SubmitButton busy={busy} label="Save customer" busyLabel="Saving" />
      </div>
    </form>
  );
}
