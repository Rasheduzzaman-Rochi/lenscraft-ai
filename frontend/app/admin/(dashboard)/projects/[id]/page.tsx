import { Mail, Phone } from "lucide-react";
import Link from "next/link";

import { ProjectForm } from "@/components/admin/project-form";
import { BackLink, Badge, DetailItem, ErrorPanel, PageHeader, Panel } from "@/components/admin/ui";
import { AdminBackendError, adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminDisplaySettings, getAdminProject, getAdminProjects, getAdminServices } from "@/lib/admin/records";
import { formatDate, formatMoney } from "@/lib/admin/time";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, display, services, statuses] = await Promise.all([
    getAdminProject(id).then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminDisplaySettings(),
    getAdminServices({ limit: 100 }).then((list) => list.items.map((service) => service.name)).catch(() => []),
    getAdminProjects({ limit: 1 }).then((list) => list.statuses).catch(() => []),
  ]);
  if ("error" in result) {
    const notFound = result.error instanceof AdminBackendError && result.error.status === 404;
    return (
      <div className="mx-auto max-w-4xl">
        <BackLink href="/admin/projects" label="Back to projects" />
        <ErrorPanel title={notFound ? "Project not found." : "Project could not be loaded."} message={notFound ? "This project is not part of your studio records." : adminConnectionMessage(result.error)} retry={!notFound} />
      </div>
    );
  }

  const project = result.value;
  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/admin/projects" label="Back to projects" />
      <div className="mt-8">
        <PageHeader eyebrow="Project" title={project.service_type ?? "Unspecified service"} description={`Created ${formatDate(project.created_at, display.timeZone)}`} actions={<Badge>{project.status}</Badge>} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Panel eyebrow="Project requirements">
          <ProjectForm project={project} statuses={statuses} serviceNames={services} timeZone={display.timeZone} />
        </Panel>
        <div className="space-y-6">
          <Panel eyebrow="Customer">
            <Link href={`/admin/customers/${project.customer_id}`} className="mt-3 block font-serif text-2xl hover:text-bronze">{project.customer_name ?? "Unknown customer"}</Link>
            <dl className="mt-5 space-y-4">
              <DetailItem label="Email">{project.customer_email ? <a href={`mailto:${project.customer_email}`} className="inline-flex items-center gap-2 text-bronze hover:text-ink"><Mail className="h-3.5 w-3.5" />{project.customer_email}</a> : "Not supplied"}</DetailItem>
              <DetailItem label="Phone">{project.customer_phone ? <a href={`tel:${project.customer_phone}`} className="inline-flex items-center gap-2 text-bronze hover:text-ink"><Phone className="h-3.5 w-3.5" />{project.customer_phone}</a> : "Not supplied"}</DetailItem>
            </dl>
          </Panel>
          <Panel eyebrow={`Related leads · ${project.leads.length}`}>
            {project.leads.length ? <ul className="mt-4 divide-y divide-ink/10">{project.leads.map((lead) => (
              <li key={lead.id} className="py-3"><Link href={`/admin/leads/${lead.id}`} className="block hover:text-bronze"><span className="flex items-center justify-between gap-2"><span className="text-sm">{formatDate(lead.created_at, display.timeZone)}</span><Badge>{lead.status}</Badge></span><span className="mt-1 line-clamp-2 block text-xs leading-5 text-ink/50">{lead.intent ?? "No intent recorded"}{lead.estimated_value != null ? ` · ${formatMoney(lead.estimated_value, display.currency)}` : ""}</span></Link></li>
            ))}</ul> : <p className="mt-4 text-sm text-ink/45">No leads for this customer.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
