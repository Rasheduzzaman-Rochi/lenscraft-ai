export type ContactSubmission = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  projectType: string;
  message: string;
};

export type BookingSubmission = {
  serviceType: string;
  dateTime: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  notes?: string;
};

export type AvailabilityResult = {
  available: boolean;
  pendingConflict?: boolean;
  message?: string;
};

export type SubmissionResult = {
  success: true;
  message: string;
};
