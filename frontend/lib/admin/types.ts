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
  service: string | null;
  source?: string | null;
  project_details: Record<string, unknown>;
};

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
    rejected: number;
    cancelled: number;
  };
  recent_leads: AdminLead[];
};
