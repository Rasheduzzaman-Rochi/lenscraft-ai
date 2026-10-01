import Link from "next/link";

import {
  ADMIN_PAGE_SIZE, adminInputClass, Badge, EmptyState, ErrorPanel, FilterBar, PageHeader, Pagination, pageNumber,
} from "@/components/admin/ui";
import { adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminDisplaySettings, getAdminProjects } from "@/lib/admin/records";
import { formatDate } from "@/lib/admin/time";

export default async function AdminProjectsPage({ searchParams }: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  const status = query.status?.trim() || undefined;
  const [result, display] = await Promise.all([
    getAdminProjects({ search: query.search?.trim(), status, limit: ADMIN_PAGE_SIZE, offset: (page - 1) * ADMIN_PAGE_SIZE })
      .then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminDisplaySettings(),
  ]);
  const statuses = "value" in result ? [...new Set([...result.value.statuses, ...(status ? [status] : [])])] : [];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow="Production" title="Projects." description="Photography jobs and delivery requirements captured from enquiries." />
      <FilterBar action="/admin/projects" search={query.search} placeholder="Search service, category or customer" resetHref="/admin/projects">
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={adminInputClass}>
          <option value="">All statuses</option>
          {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </FilterBar>
      {"error" in result ? (
        <ErrorPanel title="Projects could not be loaded." message={adminConnectionMessage(result.error)} />
      ) : result.value.items.length === 0 ? (
        <EmptyState title="No projects found." message={query.search || status ? "No projects match these filters." : "Projects are created when the voice agent or website records an enquiry."} />
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto border border-ink/10 bg-paper lg:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/10 text-[8px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                  <th className="px-6 py-4">Customer</th><th className="px-6 py-4">Service</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Products / images</th><th className="px-6 py-4">Deadline</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {result.value.items.map((project) => (
                  <tr key={project.id} className="transition hover:bg-bone/45">
                    <td className="px-6 py-5"><Link href={`/admin/projects/${project.id}`} className="font-serif text-xl hover:text-bronze">{project.customer_name ?? "Unknown customer"}</Link></td>
                    <td className="px-6 py-5 text-sm text-ink/60">{project.service_type ?? "—"}</td>
                    <td className="px-6 py-5 text-sm text-ink/60">{project.product_category ?? "—"}</td>
                    <td className="px-6 py-5 text-sm text-ink/60">{project.product_count ?? "—"} / {project.image_count ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-xs text-ink/55">{project.deadline ? formatDate(project.deadline, display.timeZone) : "—"}</td>
                    <td className="px-6 py-5"><Badge>{project.status}</Badge></td>
                    <td className="whitespace-nowrap px-6 py-5 text-xs text-ink/45">{formatDate(project.created_at, display.timeZone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 space-y-3 lg:hidden">
            {result.value.items.map((project) => (
              <Link key={project.id} href={`/admin/projects/${project.id}`} className="block border border-ink/10 bg-paper p-5">
                <div className="flex items-start justify-between gap-3"><p className="font-serif text-2xl">{project.customer_name ?? "Unknown customer"}</p><Badge>{project.status}</Badge></div>
                <p className="mt-2 text-sm text-ink/60">{project.service_type ?? "Unspecified service"}{project.product_category ? ` · ${project.product_category}` : ""}</p>
                <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-ink/40">{project.image_count ?? "—"} images · {project.deadline ? `due ${formatDate(project.deadline, display.timeZone)}` : "no deadline"}</p>
              </Link>
            ))}
          </div>
          <Pagination basePath="/admin/projects" params={{ search: query.search, status }} page={page} total={result.value.total} />
        </>
      )}
    </div>
  );
}
