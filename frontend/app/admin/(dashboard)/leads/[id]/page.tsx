import { Mail, Phone } from "lucide-react";
import Link from "next/link";

import { DeleteAdminRecord } from "@/components/admin/delete-admin-record";
import { LeadActions } from "@/components/admin/lead-actions";
import { LeadEditForm } from "@/components/admin/lead-edit-form";
import { BackLink, Badge, DetailItem, ErrorPanel, Panel } from "@/components/admin/ui";
import { AdminBackendError, adminConnectionMessage, getAdminLead } from "@/lib/admin/backend";
import { getAdminDisplaySettings } from "@/lib/admin/records";
import { formatDate, formatMoney } from "@/lib/admin/time";

function projectValue(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return value === null || value === undefined || value === "" ? null : String(value);
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, display] = await Promise.all([
    getAdminLead(id).then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminDisplaySettings(),
  ]);
  if (!("value" in result)) {
    const notFound = result.error instanceof AdminBackendError && result.error.status === 404;
    return (
      <div className="mx-auto max-w-4xl">
        <BackLink href="/admin/leads" label="Back to leads" />
        <ErrorPanel title={notFound ? "Lead not found." : "Lead details could not be loaded."} message={notFound ? "This enquiry is no longer available." : adminConnectionMessage(result.error)} retry={!notFound} />
      </div>
    );
  }

  const lead = result.value;
  const project = lead.project_details;
  const projectId = projectValue(project, "id");
  const deadline = projectValue(project, "deadline");
  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/admin/leads" label="Back to leads" />
      <div className="mt-8 flex flex-col gap-5 border-b border-ink/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Lead detail</p>
          <h1 className="mt-3 break-words font-serif text-4xl sm:text-5xl">{lead.customer_name ?? "Unassigned enquiry"}</h1>
          <p className="mt-3 text-sm text-ink/50">Received {formatDate(lead.created_at, display.timeZone)}{lead.source ? ` · via ${lead.source}` : ""}</p>
        </div>
        <Badge>{lead.status}</Badge>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel eyebrow="Customer">
          {lead.customer_id ? <Link href={`/admin/customers/${lead.customer_id}`} className="mt-3 block font-serif text-2xl hover:text-bronze">{lead.customer_name ?? "View customer"}</Link> : <p className="mt-3 text-sm text-ink/45">No customer linked.</p>}
          <dl className="mt-6 space-y-5">
            <DetailItem label="Email">{lead.email ? <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-2 text-bronze hover:text-ink"><Mail className="h-3.5 w-3.5" />{lead.email}</a> : "Not supplied"}</DetailItem>
            <DetailItem label="Phone">{lead.phone ? <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-2 text-bronze hover:text-ink"><Phone className="h-3.5 w-3.5" />{lead.phone}</a> : "Not supplied"}</DetailItem>
            <DetailItem label="Business">{[lead.business_name, lead.industry].filter(Boolean).join(" · ") || "Not supplied"}</DetailItem>
          </dl>
        </Panel>
        <Panel eyebrow="Latest project">
          {projectId ? (
            <>
              <Link href={`/admin/projects/${projectId}`} className="mt-3 block font-serif text-2xl hover:text-bronze">{lead.service ?? "Unspecified service"}</Link>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <DetailItem label="Category">{projectValue(project, "product_category") ?? "—"}</DetailItem>
                <DetailItem label="Products / images">{projectValue(project, "product_count") ?? "—"} / {projectValue(project, "image_count") ?? "—"}</DetailItem>
                <DetailItem label="Deadline">{deadline ? formatDate(deadline, display.timeZone) : "—"}</DetailItem>
                <DetailItem label="Status">{projectValue(project, "status") ?? "—"}</DetailItem>
              </dl>
            </>
          ) : <p className="mt-3 text-sm text-ink/45">No project recorded for this customer.</p>}
          <dl className="mt-6"><DetailItem label="Estimated value">{lead.estimated_value != null ? formatMoney(lead.estimated_value, display.currency) : "Not estimated"}</DetailItem></dl>
        </Panel>
      </div>

      <Panel eyebrow="Recorded intent" className="mt-6"><LeadEditForm lead={lead} currency={display.currency} /></Panel>
      <LeadActions leadId={lead.id} status={lead.status} />
      <DeleteAdminRecord id={lead.id} resource="lead" />
    </div>
  );
}
