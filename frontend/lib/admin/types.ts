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
};

export type AdminDashboard = {
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
  };
  recent_leads: AdminLead[];
};
