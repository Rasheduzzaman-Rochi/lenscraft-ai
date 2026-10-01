import Link from "next/link";

import { ADMIN_PAGE_SIZE, EmptyState, ErrorPanel, FilterBar, PageHeader, Pagination, pageNumber } from "@/components/admin/ui";
import { adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminCustomers, getAdminDisplaySettings } from "@/lib/admin/records";
import { formatDate } from "@/lib/admin/time";

export default async function AdminCustomersPage({ searchParams }: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  const [result, display] = await Promise.all([
    getAdminCustomers({ search: query.search?.trim(), limit: ADMIN_PAGE_SIZE, offset: (page - 1) * ADMIN_PAGE_SIZE })
      .then((value) => ({ value }), (error: unknown) => ({ error })),
    getAdminDisplaySettings(),
  ]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow="Client records" title="Customers." description="Contact records created by bookings, enquiries and the voice agent." />
      <FilterBar action="/admin/customers" search={query.search} placeholder="Search name, email, phone, business or industry" resetHref="/admin/customers" />
      {"error" in result ? (
        <ErrorPanel title="Customers could not be loaded." message={adminConnectionMessage(result.error)} />
      ) : result.value.items.length === 0 ? (
        <EmptyState title="No customers found." message={query.search ? "No customers match this search." : "Customers will appear after the first enquiry or booking."} />
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto border border-ink/10 bg-paper lg:block">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/10 text-[8px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                  <th className="px-6 py-4">Name</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Business</th><th className="px-6 py-4">Industry</th><th className="px-6 py-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {result.value.items.map((customer) => (
                  <tr key={customer.id} className="transition hover:bg-bone/45">
                    <td className="px-6 py-5"><Link href={`/admin/customers/${customer.id}`} className="font-serif text-xl hover:text-bronze">{customer.name}</Link></td>
                    <td className="px-6 py-5 text-xs leading-6 text-ink/55">{customer.email ?? "No email"}<br />{customer.phone ?? "No phone"}</td>
                    <td className="px-6 py-5 text-sm text-ink/60">{customer.business_name ?? "—"}</td>
                    <td className="px-6 py-5 text-sm text-ink/60">{customer.industry ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-xs text-ink/45">{formatDate(customer.created_at, display.timeZone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 space-y-3 lg:hidden">
            {result.value.items.map((customer) => (
              <Link key={customer.id} href={`/admin/customers/${customer.id}`} className="block border border-ink/10 bg-paper p-5">
                <p className="font-serif text-2xl">{customer.name}</p>
                <p className="mt-2 break-words text-xs leading-5 text-ink/50">{customer.email ?? "No email"} · {customer.phone ?? "No phone"}</p>
                <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-ink/40">{customer.business_name ?? "No business"} · {formatDate(customer.created_at, display.timeZone)}</p>
              </Link>
            ))}
          </div>
          <Pagination basePath="/admin/customers" params={{ search: query.search }} page={page} total={result.value.total} />
        </>
      )}
    </div>
  );
}
