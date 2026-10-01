import Link from "next/link";

import {
  ADMIN_PAGE_SIZE, adminInputClass, Badge, EmptyState, ErrorPanel, FilterBar, PageHeader, Pagination, pageNumber,
} from "@/components/admin/ui";
import { adminConnectionMessage, getAdminLeads } from "@/lib/admin/backend";
import { getAdminDisplaySettings } from "@/lib/admin/records";
import { formatDate } from "@/lib/admin/time";
import type { AdminLeadStatus } from "@/lib/admin/types";

const statuses: AdminLeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

export default async function AdminLeadsPage({ searchParams }: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  const status = statuses.find((option) => option === query.status);
  const [result, display] = await Promise.all([
    getAdminLeads({ search: query.search?.trim(), status, limit: ADMIN_PAGE_SIZE, offset: (page - 1) * ADMIN_PAGE_SIZE })
      .then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminDisplaySettings(),
  ]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow="Sales pipeline" title="Leads." description="Keep every studio enquiry visible from first contact to confirmed project." />
      <FilterBar action="/admin/leads" search={query.search} placeholder="Search customer, intent or source" resetHref="/admin/leads">
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={adminInputClass}>
          <option value="">All statuses</option>
          {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </FilterBar>
      {"error" in result ? (
        <ErrorPanel title="Lead data could not be loaded." message={adminConnectionMessage(result.error)} />
      ) : result.value.items.length === 0 ? (
        <EmptyState title="No leads found." message={query.search || status ? "No leads match these filters." : "New enquiries will appear here."} />
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto border border-ink/10 bg-paper lg:block">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead><tr className="border-b border-ink/10 text-[8px] font-semibold uppercase tracking-[0.18em] text-ink/40"><th className="px-6 py-4">Name</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Service</th><th className="px-6 py-4">Project details</th><th className="px-6 py-4">Source</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Created</th></tr></thead>
              <tbody className="divide-y divide-ink/10">
                {result.value.items.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-bone/45">
                    <td className="px-6 py-5"><Link href={`/admin/leads/${lead.id}`} className="font-serif text-xl hover:text-bronze">{lead.customer_name ?? "Unassigned enquiry"}</Link></td>
                    <td className="px-6 py-5 text-xs leading-6 text-ink/55">{lead.email ?? "No email"}<br />{lead.phone ?? "No phone"}</td>
                    <td className="px-6 py-5 text-sm text-ink/60">{lead.service ?? "Not specified"}</td>
                    <td className="max-w-[250px] px-6 py-5 text-xs leading-5 text-ink/50">{lead.intent ?? "Requirements awaiting review."}</td>
                    <td className="px-6 py-5 text-xs text-ink/55">{lead.source ?? "—"}</td>
                    <td className="px-6 py-5"><Badge>{lead.status}</Badge></td>
                    <td className="whitespace-nowrap px-6 py-5 text-xs text-ink/45">{formatDate(lead.created_at, display.timeZone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 space-y-3 lg:hidden">
            {result.value.items.map((lead) => (
              <Link key={lead.id} href={`/admin/leads/${lead.id}`} className="block border border-ink/10 bg-paper p-5">
                <div className="flex items-start justify-between gap-3"><p className="font-serif text-2xl">{lead.customer_name ?? "Unassigned enquiry"}</p><Badge>{lead.status}</Badge></div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/55">{lead.intent ?? "Requirements awaiting review."}</p>
                <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-ink/40">{lead.service ?? "No service"} · {formatDate(lead.created_at, display.timeZone)}</p>
              </Link>
            ))}
          </div>
          <Pagination basePath="/admin/leads" params={{ search: query.search, status }} page={page} total={result.value.total} />
        </>
      )}
    </div>
  );
}
