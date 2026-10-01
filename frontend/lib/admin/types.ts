export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export type AdminBooking = {
  id: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  service: string | null;
  date_time: string;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
  business_name: string | null;
  industry: string | null;
};

export type AdminBookingList = {
  items: AdminBooking[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminLead = {
  id: string;
  customer_name: string | null;
  email: string | null;
  status: string;
  intent: string | null;
  estimated_value: string | number | null;
  created_at: string;
  phone: string | null;
  business_name: string | null;
  industry: string | null;
  service: string | null;
  source?: string | null;
  updated_at?: string | null;
  customer_id?: string | null;
  project_details: Record<string, unknown>;
};

export type AdminLeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

export type AdminLeadList = {
  items: AdminLead[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminDashboard = {
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    rejected?: number;
    cancelled?: number;
  };
  leads: {
    total?: number;
    new?: number;
    converted?: number;
    estimated_revenue?: string | number;
    conversion_rate?: number;
  };
  revenue?: string | number;
  conversion_rate?: number;
  total_leads?: number;
  converted_leads?: number;
  recent_leads: AdminLead[];
  customers?: number;
  active_services?: number;
};

export type AdminPage<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminService = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  pricing_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminServiceList = AdminPage<AdminService> & { pricing_types: string[] };

export type AdminPricingRule = {
  id: string;
  service_id: string;
  service_name: string;
  service_is_active: boolean;
  rule_type: string;
  value: string | number;
  condition: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AdminPricingRuleList = { items: AdminPricingRule[]; rule_types: string[] };

export type AdminCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminRelatedLead = {
  id: string;
  status: string;
  source: string | null;
  intent: string | null;
  estimated_value: string | number | null;
  created_at: string;
};

export type AdminRelatedBooking = {
  id: string;
  service: string | null;
  date_time: string;
  status: string;
  created_at: string;
};

export type AdminRelatedProject = {
  id: string;
  service_type: string | null;
  product_category: string | null;
  image_count: number | null;
  deadline: string | null;
  status: string;
  created_at: string;
};

export type AdminCustomerDetail = AdminCustomer & {
  leads: AdminRelatedLead[];
  projects: AdminRelatedProject[];
  bookings: AdminRelatedBooking[];
};

export type AdminProject = {
  id: string;
  customer_id: string;
  customer_name: string | null;
  service_type: string | null;
  product_category: string | null;
  product_count: number | null;
  image_count: number | null;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AdminProjectList = AdminPage<AdminProject> & { statuses: string[] };

export type AdminProjectDetail = AdminProject & {
  customer_email: string | null;
  customer_phone: string | null;
  leads: AdminRelatedLead[];
};

export type AdminKnowledgeDocument = {
  id: string;
  title: string;
  content: string;
  has_embedding: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessHours = Record<string, { open?: string; close?: string; closed?: boolean } & Record<string, unknown>>;

export type AdminCompanySettings = {
  currency: string;
  timezone: string;
  tax_rate: string | number;
  business_hours: BusinessHours;
  settings: Record<string, unknown>;
  updated_at: string;
};
