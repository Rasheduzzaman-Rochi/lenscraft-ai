import { PricingRulesEditor } from "@/components/admin/pricing-rules-editor";
import { DeleteRecordButton } from "@/components/admin/form-parts";
import { ServiceForm } from "@/components/admin/service-form";
import { BackLink, Badge, ErrorPanel, PageHeader, Panel } from "@/components/admin/ui";
import { AdminBackendError, adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminDisplaySettings, getAdminPricingRules, getAdminService, getAdminServices } from "@/lib/admin/records";

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [serviceResult, rulesResult, typesResult, display] = await Promise.allSettled([
    getAdminService(id),
    getAdminPricingRules(id),
    getAdminServices({ limit: 1 }),
    getAdminDisplaySettings(),
  ]);

  if (serviceResult.status === "rejected") {
    const notFound = serviceResult.reason instanceof AdminBackendError && serviceResult.reason.status === 404;
    return (
      <div className="mx-auto max-w-4xl">
        <BackLink href="/admin/services" label="Back to services" />
        <ErrorPanel
          title={notFound ? "Service not found." : "Service could not be loaded."}
          message={notFound ? "This service may have been deleted." : adminConnectionMessage(serviceResult.reason)}
          retry={!notFound}
        />
      </div>
    );
  }

  const service = serviceResult.value;
  const rules = rulesResult.status === "fulfilled" ? rulesResult.value : null;
  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/admin/services" label="Back to services" />
      <div className="mt-8">
        <PageHeader
          eyebrow={service.category ?? "Service"}
          title={service.name}
          actions={<Badge tone={service.is_active ? "positive" : "muted"}>{service.is_active ? "Active" : "Inactive"}</Badge>}
        />
      </div>
      <Panel eyebrow="Details" className="mt-8">
        <div className="mt-6">
          <ServiceForm service={service} pricingTypes={typesResult.status === "fulfilled" ? typesResult.value.pricing_types : []} />
        </div>
      </Panel>
      <div className="mt-8">
        {rules ? (
          <PricingRulesEditor
            services={[service]}
            rules={rules.items}
            ruleTypes={rules.rule_types}
            currency={display.status === "fulfilled" ? display.value.currency : "USD"}
            showServiceLinks={false}
          />
        ) : (
          <ErrorPanel title="Pricing rules could not be loaded." message={adminConnectionMessage(rulesResult.status === "rejected" ? rulesResult.reason : null)} />
        )}
      </div>
      <DeleteRecordButton
        endpoint={`/api/admin/services/${service.id}`}
        resource="Service"
        recordLabel={service.name}
        redirectTo="/admin/services"
        consequences={(
          <>
            <p>Only services without pricing rules can be deleted. To stop offering a service while keeping its history and pricing, deactivate it instead.</p>
            <p>Saved bookings and projects keep their recorded service name.</p>
          </>
        )}
      />
    </div>
  );
}
