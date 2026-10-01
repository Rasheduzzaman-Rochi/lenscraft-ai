import { PricingRulesEditor } from "@/components/admin/pricing-rules-editor";
import { EmptyState, ErrorPanel, PageHeader } from "@/components/admin/ui";
import { adminConnectionMessage } from "@/lib/admin/backend";
import { getAdminDisplaySettings, getAdminPricingRules, getAdminServices } from "@/lib/admin/records";

export default async function AdminPricingPage() {
  const [servicesResult, rulesResult, display] = await Promise.allSettled([
    getAdminServices({ limit: 100 }),
    getAdminPricingRules(),
    getAdminDisplaySettings(),
  ]);
  const failure = servicesResult.status === "rejected" ? servicesResult.reason : rulesResult.status === "rejected" ? rulesResult.reason : null;
  const currency = display.status === "fulfilled" ? display.value.currency : "USD";

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Quotes"
        title="Pricing rules."
        description={`Rates the voice agent uses for quotes, in ${currency}. Changes apply to the next quote. Prices are before tax and discounts; the tax rate is managed in Settings.`}
      />
      {failure !== null || servicesResult.status !== "fulfilled" || rulesResult.status !== "fulfilled" ? (
        <ErrorPanel title="Pricing could not be loaded." message={adminConnectionMessage(failure)} />
      ) : servicesResult.value.items.length === 0 ? (
        <EmptyState title="No services yet." message="Create a service before adding pricing rules." />
      ) : (
        <div className="mt-8">
          <PricingRulesEditor services={servicesResult.value.items} rules={rulesResult.value.items} ruleTypes={rulesResult.value.rule_types} currency={currency} />
        </div>
      )}
    </div>
  );
}
