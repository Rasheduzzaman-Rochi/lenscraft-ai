import Link from "next/link";

import { CustomerForm } from "@/components/admin/customer-form";
import { BackLink, Badge, bookingTone, ErrorPanel, PageHeader, Panel } from "@/components/admin/ui";
import { AdminBackendError, adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminCustomer, getAdminDisplaySettings } from "@/lib/admin/records";
import { formatDate, formatDateTime, formatMoney } from "@/lib/admin/time";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, display] = await Promise.all([
    getAdminCustomer(id).then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminDisplaySettings(),
  ]);
  if ("error" in result) {
    const notFound = result.error instanceof AdminBackendError && result.error.status === 404;
    return (
      <div className="mx-auto max-w-4xl">
        <BackLink href="/admin/customers" label="Back to customers" />
        <ErrorPanel title={notFound ? "Customer not found." : "Customer could not be loaded."} message={notFound ? "This customer is not part of your studio records." : adminConnectionMessage(result.error)} retry={!notFound} />
      </div>
    );
  }

  const customer = result.value;
  const { timeZone, currency } = display;
  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/admin/customers" label="Back to customers" />
      <div className="mt-8"><PageHeader eyebrow="Customer" title={customer.name} description={`Customer since ${formatDate(customer.created_at, timeZone)}`} /></div>
      <Panel eyebrow="Contact details" className="mt-8"><CustomerForm customer={customer} /></Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel eyebrow={`Leads · ${customer.leads.length}`}>
          {customer.leads.length ? <ul className="mt-4 divide-y divide-ink/10">{customer.leads.map((lead) => (
            <li key={lead.id} className="py-3"><Link href={`/admin/leads/${lead.id}`} className="block hover:text-bronze"><span className="flex items-center justify-between gap-2"><span className="text-sm">{formatDate(lead.created_at, timeZone)}</span><Badge>{lead.status}</Badge></span><span className="mt-1 line-clamp-2 block text-xs leading-5 text-ink/50">{lead.intent ?? "No intent recorded"}{lead.estimated_value != null ? ` · ${formatMoney(lead.estimated_value, currency)}` : ""}</span></Link></li>
          ))}</ul> : <p className="mt-4 text-sm text-ink/45">No leads.</p>}
        </Panel>
        <Panel eyebrow={`Projects · ${customer.projects.length}`}>
          {customer.projects.length ? <ul className="mt-4 divide-y divide-ink/10">{customer.projects.map((project) => (
            <li key={project.id} className="py-3"><Link href={`/admin/projects/${project.id}`} className="block hover:text-bronze"><span className="flex items-center justify-between gap-2"><span className="text-sm">{project.service_type ?? "Unspecified service"}</span><Badge>{project.status}</Badge></span><span className="mt-1 block text-xs text-ink/50">{project.image_count != null ? `${project.image_count} images` : "Image count not set"}{project.deadline ? ` · due ${formatDate(project.deadline, timeZone)}` : ""}</span></Link></li>
          ))}</ul> : <p className="mt-4 text-sm text-ink/45">No projects.</p>}
        </Panel>
        <Panel eyebrow={`Bookings · ${customer.bookings.length}`}>
          {customer.bookings.length ? <ul className="mt-4 divide-y divide-ink/10">{customer.bookings.map((booking) => (
            <li key={booking.id} className="py-3"><Link href={`/admin/bookings/${booking.id}`} className="block hover:text-bronze"><span className="flex items-center justify-between gap-2"><span className="text-sm">{booking.service ?? "Unspecified service"}</span><Badge tone={bookingTone(booking.status)}>{booking.status}</Badge></span><span className="mt-1 block text-xs text-ink/50">{formatDateTime(booking.date_time, timeZone)}</span></Link></li>
          ))}</ul> : <p className="mt-4 text-sm text-ink/45">No bookings.</p>}
        </Panel>
      </div>
    </div>
  );
}
