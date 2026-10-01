"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminField, FormFeedback, SubmitButton, Warning } from "@/components/admin/form-parts";
import { adminInputClass, adminSecondaryButtonClass, Badge } from "@/components/admin/ui";
import { useAdminMutation } from "@/components/admin/use-admin-mutation";
import { formatMoney } from "@/lib/admin/time";
import type { AdminPricingRule, AdminService } from "@/lib/admin/types";

const RATE_TYPES = new Set(["base", "per_image"]);
const DECIMAL = /^-?\d{1,14}(\.\d{1,4})?$/;

/** The rate rule the quote engine requires for a service pricing type, if it quotes automatically. */
function expectedRateType(pricingType: string) {
  return pricingType === "fixed" ? "base" : pricingType === "per_image" ? "per_image" : undefined;
}

function conditionSummary(rule: AdminPricingRule) {
  if (rule.rule_type === "addon") {
    return `Add-on “${String(rule.condition.code ?? "")}” · ${String(rule.condition.pricing_type ?? "")}`;
  }
  return Object.keys(rule.condition).length ? JSON.stringify(rule.condition) : "No conditions";
}

function unitLabel(rule: AdminPricingRule) {
  if (rule.rule_type === "per_image" || rule.condition.pricing_type === "per_image") return "per image";
  if (rule.rule_type === "base" || rule.condition.pricing_type === "fixed") return "flat";
  return "";
}

function RuleForm({ service, rule, ruleTypes, onDone }: {
  service: AdminService;
  rule?: AdminPricingRule;
  ruleTypes: string[];
  onDone: () => void;
}) {
  const expected = expectedRateType(service.pricing_type);
  const defaultType = rule?.rule_type ?? expected ?? "addon";
  const [ruleType, setRuleType] = useState(defaultType);
  const [value, setValue] = useState(rule ? String(rule.value) : "");
  const [addonCode, setAddonCode] = useState(typeof rule?.condition.code === "string" ? rule.condition.code : "");
  const [addonPricing, setAddonPricing] = useState(rule?.condition.pricing_type === "per_image" ? "per_image" : "fixed");
  const [customCondition, setCustomCondition] = useState(
    rule && rule.rule_type !== "addon" && !RATE_TYPES.has(rule.rule_type) ? JSON.stringify(rule.condition, null, 2) : "{}",
  );
  const { busy, error, success, run, setError } = useAdminMutation();
  const options = [...new Set([...ruleTypes, ruleType])].sort();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = value.trim();
    if (!DECIMAL.test(amount)) {
      setError("Enter a number with at most 4 decimal places.");
      return;
    }
    if ((RATE_TYPES.has(ruleType) || ruleType === "addon") && amount.startsWith("-")) {
      setError("Rates and add-on prices cannot be negative.");
      return;
    }
    let condition: Record<string, unknown> = {};
    if (ruleType === "addon") {
      if (!addonCode.trim()) {
        setError("Add-ons need a code the voice agent can reference.");
        return;
      }
      condition = { code: addonCode.trim(), pricing_type: addonPricing };
    } else if (!RATE_TYPES.has(ruleType)) {
      try {
        const parsed: unknown = JSON.parse(customCondition || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        condition = parsed as Record<string, unknown>;
      } catch {
        setError("The condition must be a JSON object, for example {}.");
        return;
      }
    }
    const body = { rule_type: ruleType, value: amount, condition };
    const result = rule
      ? await run(`/api/admin/pricing-rules/${rule.id}`, "PATCH", { ...body, expected_updated_at: rule.updated_at }, {
        success: "Pricing rule saved.", fallbackError: "The pricing rule could not be saved.",
      })
      : await run("/api/admin/pricing-rules", "POST", { ...body, service_id: service.id }, {
        success: "Pricing rule added.", fallbackError: "The pricing rule could not be added.",
      });
    if (result !== undefined) onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-5 border border-ink/10 bg-bone/40 p-4 sm:p-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <AdminField label="Rule type" htmlFor={`rule-type-${rule?.id ?? service.id}`}>
          <select id={`rule-type-${rule?.id ?? service.id}`} value={ruleType} onChange={(event) => setRuleType(event.target.value)} className={adminInputClass}>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </AdminField>
        <AdminField label="Value" htmlFor={`rule-value-${rule?.id ?? service.id}`} hint="Amount in the studio currency.">
          <input id={`rule-value-${rule?.id ?? service.id}`} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} required placeholder="0.00" className={adminInputClass} />
        </AdminField>
        {ruleType === "addon" ? (
          <>
            <AdminField label="Add-on code" htmlFor={`rule-code-${rule?.id ?? service.id}`}>
              <input id={`rule-code-${rule?.id ?? service.id}`} value={addonCode} onChange={(event) => setAddonCode(event.target.value)} maxLength={100} className={adminInputClass} />
            </AdminField>
            <AdminField label="Add-on pricing" htmlFor={`rule-addon-pricing-${rule?.id ?? service.id}`}>
              <select id={`rule-addon-pricing-${rule?.id ?? service.id}`} value={addonPricing} onChange={(event) => setAddonPricing(event.target.value)} className={adminInputClass}>
                <option value="fixed">fixed</option>
                <option value="per_image">per_image</option>
              </select>
            </AdminField>
          </>
        ) : !RATE_TYPES.has(ruleType) ? (
          <AdminField label="Condition (JSON)" htmlFor={`rule-condition-${rule?.id ?? service.id}`} className="sm:col-span-2" hint="Only change this if you know how the quote workflow reads this rule type.">
            <textarea id={`rule-condition-${rule?.id ?? service.id}`} value={customCondition} onChange={(event) => setCustomCondition(event.target.value)} rows={3} className={`${adminInputClass} h-auto py-3 font-mono text-xs`} />
          </AdminField>
        ) : null}
      </div>
      {RATE_TYPES.has(ruleType) && expected && ruleType !== expected ? (
        <Warning>This service uses the “{service.pricing_type}” pricing type. Automatic quotes expect a {expected} rule for it.</Warning>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FormFeedback error={error} success={success} />
        <div className="flex gap-2">
          <button type="button" onClick={onDone} disabled={busy} className={adminSecondaryButtonClass}>Cancel</button>
          <SubmitButton busy={busy} label={rule ? "Save rule" : "Add rule"} busyLabel="Saving" />
        </div>
      </div>
    </form>
  );
}

export function PricingRulesEditor({ services, rules, ruleTypes, currency, showServiceLinks = true }: {
  services: AdminService[];
  rules: AdminPricingRule[];
  ruleTypes: string[];
  currency: string;
  showServiceLinks?: boolean;
}) {
  const [editing, setEditing] = useState<string>();
  const [adding, setAdding] = useState<string>();
  const [deleting, setDeleting] = useState<AdminPricingRule>();
  const removal = useAdminMutation();

  async function remove() {
    if (!deleting) return;
    const result = await removal.run(`/api/admin/pricing-rules/${deleting.id}`, "DELETE", undefined, {
      success: "Pricing rule deleted.", fallbackError: "The pricing rule could not be deleted.",
    });
    if (result !== undefined) setDeleting(undefined);
  }

  return (
    <div className="space-y-6">
      {services.map((service) => {
        const serviceRules = rules.filter((rule) => rule.service_id === service.id);
        return (
          <section key={service.id} className="border border-ink/10 bg-paper">
            <div className="flex flex-col gap-3 border-b border-ink/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="min-w-0">
                {showServiceLinks ? (
                  <Link href={`/admin/services/${service.id}`} className="font-serif text-2xl hover:text-bronze">{service.name}</Link>
                ) : <h2 className="font-serif text-2xl">Pricing rules</h2>}
                <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-ink/40">Pricing type · {service.pricing_type}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={service.is_active ? "positive" : "muted"}>{service.is_active ? "Active" : "Inactive"}</Badge>
                <button type="button" onClick={() => { setAdding(service.id); setEditing(undefined); }} className={adminSecondaryButtonClass}>
                  <Plus className="h-3.5 w-3.5" /> Add rule
                </button>
              </div>
            </div>
            <div className="divide-y divide-ink/10">
              {serviceRules.length === 0 && adding !== service.id ? (
                <p className="px-5 py-6 text-sm text-ink/45 sm:px-7">
                  {expectedRateType(service.pricing_type)
                    ? "No pricing rules. Automatic quotes are unavailable until a rate is added."
                    : "No pricing rules. This service is quoted manually."}
                </p>
              ) : null}
              {serviceRules.map((rule) => (
                <div key={rule.id} className="px-5 py-5 sm:px-7">
                  {editing === rule.id ? (
                    <RuleForm service={service} rule={rule} ruleTypes={ruleTypes} onDone={() => setEditing(undefined)} />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                      <div>
                        <p className="eyebrow">{rule.rule_type}</p>
                        <p className="mt-2 font-serif text-2xl">{formatMoney(rule.value, currency)} <span className="text-xs text-ink/45">{unitLabel(rule)}</span></p>
                      </div>
                      <p className="break-words text-xs leading-5 text-ink/50">{conditionSummary(rule)}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setEditing(rule.id); setAdding(undefined); }} className="inline-flex min-h-9 items-center gap-2 border border-ink/15 px-3 text-[8px] font-semibold uppercase tracking-[0.16em] hover:border-ink/40"><Pencil className="h-3 w-3" /> Edit</button>
                        <button type="button" onClick={() => setDeleting(rule)} className="inline-flex min-h-9 items-center gap-2 border border-ink/15 px-3 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#8d433b] hover:border-[#8d433b]"><Trash2 className="h-3 w-3" /> Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {adding === service.id ? (
                <div className="px-5 py-5 sm:px-7"><RuleForm service={service} ruleTypes={ruleTypes} onDone={() => setAdding(undefined)} /></div>
              ) : null}
            </div>
          </section>
        );
      })}
      <ConfirmDialog
        open={deleting !== undefined}
        destructive
        busy={removal.busy}
        title={deleting ? `Delete the ${deleting.rule_type} rule for ${deleting.service_name}?` : "Delete pricing rule?"}
        confirmLabel={removal.busy ? "Deleting" : "Delete rule"}
        onConfirm={() => void remove()}
        onCancel={() => { setDeleting(undefined); removal.setError(undefined); }}
      >
        {deleting ? <p>Value: {formatMoney(deleting.value, currency)} {unitLabel(deleting)}. The voice agent reads pricing rules on every quote, so this takes effect immediately.</p> : null}
        {removal.error ? <p role="alert" className="text-[#8d433b]">{removal.error}</p> : null}
      </ConfirmDialog>
    </div>
  );
}
