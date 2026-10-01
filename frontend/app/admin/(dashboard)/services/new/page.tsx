import { ServiceForm } from "@/components/admin/service-form";
import { BackLink, PageHeader, Panel } from "@/components/admin/ui";
import { getAdminServices } from "@/lib/admin/records";

export default async function NewServicePage() {
  const pricingTypes = await getAdminServices({ limit: 1 }).then((list) => list.pricing_types).catch(() => []);
  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/admin/services" label="Back to services" />
      <div className="mt-8"><PageHeader eyebrow="Service catalog" title="New service." description="Add the service first, then add its pricing rule so the voice agent can quote it." /></div>
      <Panel className="mt-8"><ServiceForm pricingTypes={pricingTypes} /></Panel>
    </div>
  );
}
