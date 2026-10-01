"use client";

import { FormEvent, useState } from "react";

import { AdminField, FormFeedback, SubmitButton, Warning } from "@/components/admin/form-parts";
import { adminInputClass } from "@/components/admin/ui";
import { useAdminMutation } from "@/components/admin/use-admin-mutation";
import type { AdminService } from "@/lib/admin/types";

const ENGINE_PRICING_TYPES = ["fixed", "per_image"];

export function ServiceForm({ service, pricingTypes }: { service?: AdminService; pricingTypes: string[] }) {
  const [name, setName] = useState(service?.name ?? "");
  const [category, setCategory] = useState(service?.category ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [pricingType, setPricingType] = useState(service?.pricing_type ?? "per_image");
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const { busy, error, success, run } = useAdminMutation();
  const options = [...new Set([...ENGINE_PRICING_TYPES, ...pricingTypes, pricingType])].sort();
  const renamed = service !== undefined && name.trim() !== service.name;
  const deactivating = service?.is_active === true && !isActive;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      name: name.trim(),
      category: category.trim() || null,
      description: description.trim() || null,
      pricing_type: pricingType,
      is_active: isActive,
    };
    if (service) {
      await run(`/api/admin/services/${service.id}`, "PATCH", { ...body, expected_updated_at: service.updated_at }, {
        success: "Service saved.",
        fallbackError: "The service could not be saved.",
      });
    } else {
      await run<AdminService>("/api/admin/services", "POST", body, {
        success: "Service created.",
        fallbackError: "The service could not be created.",
        redirect: (created) => `/admin/services/${created.id}`,
      });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <AdminField label="Service name" htmlFor="service-name" className="sm:col-span-2">
          <input id="service-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} className={adminInputClass} />
        </AdminField>
        <AdminField label="Category" htmlFor="service-category">
          <input id="service-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={200} className={adminInputClass} />
        </AdminField>
        <AdminField
          label="Pricing type"
          htmlFor="service-pricing-type"
          hint="fixed uses one base rule; per_image multiplies one per_image rule by the image count. Other types are quoted manually."
        >
          <select id="service-pricing-type" value={pricingType} onChange={(event) => setPricingType(event.target.value)} className={adminInputClass}>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </AdminField>
        <AdminField label="Description" htmlFor="service-description" className="sm:col-span-2" hint="Shown to the voice agent when it searches the service catalog.">
          <textarea id="service-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={5} className={`${adminInputClass} h-auto py-3`} />
        </AdminField>
        <label className="flex items-center gap-3 text-sm sm:col-span-2">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 accent-ink" />
          Active — offered to customers and the voice agent
        </label>
      </div>

      {renamed ? (
        <Warning>
          The voice agent finds services, quotes and booking slot durations by their exact name. Renaming
          “{service?.name}” can stop existing agent prompts, slot duration settings, or saved bookings that use the old name
          from matching. Update those references in Settings and the agent configuration if you continue.
        </Warning>
      ) : null}
      {deactivating ? (
        <Warning>Deactivating hides this service from the voice agent&apos;s service search and quotes. Existing bookings are not changed.</Warning>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <FormFeedback error={error} success={success} />
        <SubmitButton busy={busy} label={service ? "Save service" : "Create service"} busyLabel="Saving" />
      </div>
    </form>
  );
}
