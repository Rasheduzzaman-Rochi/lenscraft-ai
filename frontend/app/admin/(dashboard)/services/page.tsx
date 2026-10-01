import { Plus } from "lucide-react";
import Link from "next/link";

import {
  ADMIN_PAGE_SIZE, adminInputClass, adminPrimaryButtonClass, Badge, EmptyState, ErrorPanel, FilterBar, PageHeader,
  Pagination, pageNumber,
} from "@/components/admin/ui";
import { adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminDisplaySettings, getAdminPricingRules, getAdminServices } from "@/lib/admin/records";
import { formatMoney } from "@/lib/admin/time";

export default async function AdminServicesPage({ searchParams }: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  const status = query.status === "active" || query.status === "inactive" ? query.status : undefined;
  const [servicesResult, rulesResult, display] = await Promise.allSettled([
    getAdminServices({
      search: query.search?.trim(),
      active: status === undefined ? undefined : status === "active",
      limit: ADMIN_PAGE_SIZE,
      offset: (page - 1) * ADMIN_PAGE_SIZE,
    }),
    getAdminPricingRules(),
    getAdminDisplaySettings(),
  ]);
  const currency = display.status === "fulfilled" ? display.value.currency : "USD";
  const rules = rulesResult.status === "fulfilled" ? rulesResult.value.items : [];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow="Service catalog"
        title="Services."
        description="The photography services offered on the website and to the voice agent."
        actions={<Link href="/admin/services/new" className={adminPrimaryButtonClass}><Plus className="h-3.5 w-3.5" /> New service</Link>}
      />
      <FilterBar action="/admin/services" search={query.search} placeholder="Search name, category or description" resetHref="/admin/services">
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={adminInputClass}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </FilterBar>

      {servicesResult.status === "rejected" ? (
        <ErrorPanel title="Services could not be loaded." message={adminConnectionMessage(servicesResult.reason)} />
      ) : servicesResult.value.items.length === 0 ? (
        <EmptyState title="No services found." message={query.search || status ? "No services match these filters." : "Create the first service to start quoting."} />
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {servicesResult.value.items.map((service) => {
              const serviceRules = rules.filter((rule) => rule.service_id === service.id && rule.rule_type !== "addon");
              return (
                <Link key={service.id} href={`/admin/services/${service.id}`} className="group flex flex-col border border-ink/10 bg-paper p-6 transition hover:border-ink/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="eyebrow">{service.category ?? "Uncategorised"}</p>
                      <h2 className="mt-3 font-serif text-2xl group-hover:text-bronze">{service.name}</h2>
                    </div>
                    <Badge tone={service.is_active ? "positive" : "muted"}>{service.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-ink/55">{service.description ?? "No description."}</p>
                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-ink/10 pt-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-ink/40">{service.pricing_type}</p>
                    <p className="text-right text-sm text-ink/70">
                      {rulesResult.status === "rejected"
                        ? "Rates unavailable"
                        : serviceRules.length
                          ? serviceRules.map((rule) => `${formatMoney(rule.value, currency)}${rule.rule_type === "per_image" ? " / image" : ""}`).join(" · ")
                          : "No rate"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination basePath="/admin/services" params={{ search: query.search, status }} page={page} total={servicesResult.value.total} />
        </>
      )}
    </div>
  );
}
