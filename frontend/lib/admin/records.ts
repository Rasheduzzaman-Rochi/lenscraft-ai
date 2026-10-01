import "server-only";

import { cache } from "react";

import { adminBackendRequest } from "@/lib/admin/backend";
import type {
  AdminCompanySettings,
  AdminCustomer,
  AdminCustomerDetail,
  AdminKnowledgeDocument,
  AdminPage,
  AdminPricingRule,
  AdminPricingRuleList,
  AdminProject,
  AdminProjectDetail,
  AdminProjectList,
  AdminService,
  AdminServiceList,
} from "@/lib/admin/types";

type ListOptions = { search?: string; limit?: number; offset?: number };

function listQuery(options: ListOptions & Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

function id(value: string) {
  return encodeURIComponent(value);
}

function send<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  return adminBackendRequest<T>(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const getAdminServices = (options: ListOptions & { active?: boolean } = {}) =>
  adminBackendRequest<AdminServiceList>(`/api/v1/admin/services${listQuery(options)}`);
export const getAdminService = (serviceId: string) =>
  adminBackendRequest<AdminService>(`/api/v1/admin/services/${id(serviceId)}`);
export const createAdminService = (body: unknown) => send<AdminService>("/api/v1/admin/services", "POST", body);
export const updateAdminService = (serviceId: string, body: unknown) =>
  send<AdminService>(`/api/v1/admin/services/${id(serviceId)}`, "PATCH", body);
export const deleteAdminService = (serviceId: string) =>
  send<{ id: string; deleted: true }>(`/api/v1/admin/services/${id(serviceId)}`, "DELETE");

export const getAdminPricingRules = (serviceId?: string) =>
  adminBackendRequest<AdminPricingRuleList>(`/api/v1/admin/pricing-rules${listQuery({ service_id: serviceId })}`);
export const createAdminPricingRule = (body: unknown) =>
  send<AdminPricingRule>("/api/v1/admin/pricing-rules", "POST", body);
export const updateAdminPricingRule = (ruleId: string, body: unknown) =>
  send<AdminPricingRule>(`/api/v1/admin/pricing-rules/${id(ruleId)}`, "PATCH", body);
export const deleteAdminPricingRule = (ruleId: string) =>
  send<{ id: string; deleted: true }>(`/api/v1/admin/pricing-rules/${id(ruleId)}`, "DELETE");

export const getAdminCustomers = (options: ListOptions = {}) =>
  adminBackendRequest<AdminPage<AdminCustomer>>(`/api/v1/admin/customers${listQuery(options)}`);
export const getAdminCustomer = (customerId: string) =>
  adminBackendRequest<AdminCustomerDetail>(`/api/v1/admin/customers/${id(customerId)}`);
export const updateAdminCustomer = (customerId: string, body: unknown) =>
  send<AdminCustomer>(`/api/v1/admin/customers/${id(customerId)}`, "PATCH", body);

export const getAdminProjects = (options: ListOptions & { status?: string } = {}) =>
  adminBackendRequest<AdminProjectList>(`/api/v1/admin/projects${listQuery(options)}`);
export const getAdminProject = (projectId: string) =>
  adminBackendRequest<AdminProjectDetail>(`/api/v1/admin/projects/${id(projectId)}`);
export const updateAdminProject = (projectId: string, body: unknown) =>
  send<AdminProject>(`/api/v1/admin/projects/${id(projectId)}`, "PATCH", body);

export const getAdminKnowledgeList = (options: ListOptions = {}) =>
  adminBackendRequest<AdminPage<AdminKnowledgeDocument>>(`/api/v1/admin/knowledge${listQuery(options)}`);
export const getAdminKnowledge = (documentId: string) =>
  adminBackendRequest<AdminKnowledgeDocument>(`/api/v1/admin/knowledge/${id(documentId)}`);
export const createAdminKnowledge = (body: unknown) =>
  send<AdminKnowledgeDocument>("/api/v1/admin/knowledge", "POST", body);
export const updateAdminKnowledge = (documentId: string, body: unknown) =>
  send<AdminKnowledgeDocument>(`/api/v1/admin/knowledge/${id(documentId)}`, "PATCH", body);
export const deleteAdminKnowledge = (documentId: string) =>
  send<{ id: string; deleted: true }>(`/api/v1/admin/knowledge/${id(documentId)}`, "DELETE");

export const getAdminCompanySettings = () =>
  adminBackendRequest<AdminCompanySettings>("/api/v1/admin/settings");
export const updateAdminCompanySettings = (body: unknown) =>
  send<AdminCompanySettings>("/api/v1/admin/settings", "PATCH", body);

/**
 * Studio display preferences for formatting, deduplicated per request. Falls back to UTC with an
 * explicit zone label so a settings outage never silently shifts displayed times.
 */
export const getAdminDisplaySettings = cache(async () => {
  try {
    const settings = await getAdminCompanySettings();
    return { timeZone: settings.timezone, currency: settings.currency, available: true };
  } catch {
    return { timeZone: "UTC", currency: "USD", available: false };
  }
});
