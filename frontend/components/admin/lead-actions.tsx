"use client";

import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminLeadStatus } from "@/lib/admin/types";

const statuses: AdminLeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

export function LeadActions({ leadId, status }: { leadId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const normalizedStatus = status.trim().toLowerCase() as AdminLeadStatus;

  async function updateStatus(nextStatus: AdminLeadStatus) {
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json().catch(() => null) as { message?: unknown } | null;
      if (!response.ok) {
        setMessage(typeof result?.message === "string" ? result.message : "Lead status could not be updated.");
        return;
      }
      setMessage("Lead status updated.");
      router.refresh();
    } catch {
      setMessage("Lead status could not be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 border border-ink/10 bg-paper p-6 sm:p-8">
      <p className="eyebrow">Lead actions</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="lead-status">Lead status</label>
        <select
          id="lead-status"
          value={statuses.includes(normalizedStatus) ? normalizedStatus : "new"}
          disabled={busy}
          onChange={(event) => void updateStatus(event.target.value as AdminLeadStatus)}
          className="h-10 border border-ink/15 bg-paper px-3 text-[9px] font-semibold uppercase tracking-[0.16em] outline-none focus:border-ink"
        >
          {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin text-bronze" /> : <Check className="h-4 w-4 text-bronze" />}
        {normalizedStatus !== "converted" ? <Link href={`/admin/bookings/new?lead=${encodeURIComponent(leadId)}`} className="inline-flex items-center gap-2 bg-ink px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-bronze">Convert to booking <ArrowRight className="h-3.5 w-3.5" /></Link> : null}
      </div>
      {message ? <p role="status" className="mt-3 text-xs text-ink/55">{message}</p> : null}
    </div>
  );
}
