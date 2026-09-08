import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { LeadBookingForm } from "@/components/admin/lead-booking-form";
import { RetryButton } from "@/components/admin/retry-button";
import { AdminBackendError, getAdminLead } from "@/lib/admin/backend";

export default async function NewBookingFromLeadPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: leadId } = await searchParams;
  if (!leadId) return <div className="mx-auto max-w-4xl"><Link href="/admin/leads" className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to leads</Link><div className="mt-10 border border-ink/10 bg-paper p-8"><h1 className="font-serif text-4xl">Choose a lead to convert.</h1><p className="mt-4 text-sm text-ink/55">Open a lead first so customer information can be prefilled.</p></div></div>;

  const result = await getAdminLead(leadId).then((value) => ({ value })).catch((error) => ({ error }));
  if (!("value" in result)) {
    const notFound = result.error instanceof AdminBackendError && result.error.status === 404;
    return <div className="mx-auto max-w-4xl"><Link href="/admin/leads" className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to leads</Link><div className="mt-10 border border-[#b36a60]/30 bg-[#b36a60]/10 p-8"><h1 className="font-serif text-4xl">{notFound ? "Lead not found." : "Lead could not be loaded."}</h1><p className="mt-4 text-sm text-ink/55">{notFound ? "This enquiry is no longer available." : "The studio connection did not respond."}</p>{!notFound ? <div className="mt-6"><RetryButton /></div> : null}</div></div>;
  }

  return <div className="mx-auto max-w-5xl"><Link href={`/admin/leads/${leadId}`} className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to lead</Link><div className="mt-8 border-b border-ink/10 pb-8"><p className="eyebrow">Lead conversion</p><h1 className="mt-3 font-serif text-5xl tracking-[-0.03em]">Create a booking.</h1><p className="mt-4 text-sm text-ink/50">Review the prefilled customer information and choose the requested appointment.</p></div><LeadBookingForm lead={result.value} /></div>;
}
