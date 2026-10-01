"use client";

import { FormEvent, useState } from "react";

import { AdminField, FormFeedback, SubmitButton } from "@/components/admin/form-parts";
import { adminInputClass } from "@/components/admin/ui";
import { useAdminMutation } from "@/components/admin/use-admin-mutation";
import { isoToZonedLocal, zonedLocalToIso } from "@/lib/admin/time";
import type { AdminProject } from "@/lib/admin/types";

function countValue(value: string) {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{1,9}$/.test(text)) throw new Error("count");
  return Number(text);
}

export function ProjectForm({ project, statuses, serviceNames, timeZone }: {
  project: AdminProject;
  statuses: string[];
  serviceNames: string[];
  timeZone: string;
}) {
  const [serviceType, setServiceType] = useState(project.service_type ?? "");
  const [category, setCategory] = useState(project.product_category ?? "");
  const [productCount, setProductCount] = useState(project.product_count?.toString() ?? "");
  const [imageCount, setImageCount] = useState(project.image_count?.toString() ?? "");
  const initialDeadline = project.deadline ? isoToZonedLocal(project.deadline, timeZone) : "";
  const [deadline, setDeadline] = useState(initialDeadline);
  const [status, setStatus] = useState(project.status);
  const { busy, error, success, run, setError } = useAdminMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let counts: { product_count: number | null; image_count: number | null };
    try {
      counts = { product_count: countValue(productCount), image_count: countValue(imageCount) };
    } catch {
      setError("Counts must be whole numbers of zero or more.");
      return;
    }
    const next: Record<string, unknown> = {
      service_type: serviceType.trim() || null,
      product_category: category.trim() || null,
      ...counts,
      status: status.trim(),
    };
    // Send only edited columns, so an untouched deadline keeps its exact stored instant.
    const body = Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== project[key as keyof AdminProject]));
    if (deadline !== initialDeadline) body.deadline = deadline ? zonedLocalToIso(deadline, timeZone) : null;
    await run(`/api/admin/projects/${project.id}`, "PATCH", { ...body, expected_updated_at: project.updated_at }, {
      success: Object.keys(body).length ? "Project saved." : "No changes to save.",
      fallbackError: "The project could not be saved.",
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <AdminField label="Service" htmlFor="project-service">
          <input id="project-service" list="project-service-options" value={serviceType} onChange={(event) => setServiceType(event.target.value)} maxLength={500} className={adminInputClass} />
          <datalist id="project-service-options">{serviceNames.map((name) => <option key={name} value={name} />)}</datalist>
        </AdminField>
        <AdminField label="Product category" htmlFor="project-category">
          <input id="project-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={200} className={adminInputClass} />
        </AdminField>
        <AdminField label="Product count" htmlFor="project-products">
          <input id="project-products" inputMode="numeric" value={productCount} onChange={(event) => setProductCount(event.target.value)} className={adminInputClass} />
        </AdminField>
        <AdminField label="Image count" htmlFor="project-images">
          <input id="project-images" inputMode="numeric" value={imageCount} onChange={(event) => setImageCount(event.target.value)} className={adminInputClass} />
        </AdminField>
        <AdminField label="Deadline" htmlFor="project-deadline" hint={`Studio time (${timeZone}).`}>
          <input id="project-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={adminInputClass} />
        </AdminField>
        <AdminField label="Status" htmlFor="project-status" hint="Statuses already used by your projects are suggested.">
          <input id="project-status" list="project-status-options" value={status} onChange={(event) => setStatus(event.target.value)} required maxLength={100} className={adminInputClass} />
          <datalist id="project-status-options">{statuses.map((option) => <option key={option} value={option} />)}</datalist>
        </AdminField>
      </div>
      <div className="flex flex-col gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <FormFeedback error={error} success={success} />
        <SubmitButton busy={busy} label="Save project" busyLabel="Saving" />
      </div>
    </form>
  );
}
