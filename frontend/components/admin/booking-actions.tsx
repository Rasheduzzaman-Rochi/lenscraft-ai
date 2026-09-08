"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { BookingStatus } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

const actions: Array<{ status: Exclude<BookingStatus, "pending">; label: string; className: string }> = [
  { status: "confirmed", label: "Confirm", className: "bg-ink text-paper hover:bg-bronze" },
  { status: "rejected", label: "Reject", className: "border border-ink/15 hover:border-[#8d433b] hover:text-[#8d433b]" },
];

export function BookingActions({ bookingId, allowCancel = false }: { bookingId: string; allowCancel?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<BookingStatus | null>(null);
  const [message, setMessage] = useState<string>();

  async function update(status: Exclude<BookingStatus, "pending">) {
    const accepted = window.confirm(`Mark this booking as ${status}? This action cannot be reversed here.`);
    if (!accepted) return;
    setBusy(status);
    setMessage(undefined);
    try {
      const response = await fetch("/api/admin/bookings/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, status }),
      });
      const result = await response.json().catch(() => null) as { message?: unknown } | null;
      if (!response.ok) {
        setMessage(typeof result?.message === "string" ? result.message : "The booking could not be updated.");
        return;
      }
      setMessage(`Booking ${status} successfully.`);
      window.setTimeout(() => router.refresh(), 450);
    } catch {
      setMessage("The booking could not be updated. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(allowCancel ? [...actions, { status: "cancelled" as const, label: "Cancel", className: "border border-ink/15 hover:border-[#8d433b] hover:text-[#8d433b]" }] : actions).map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={busy !== null}
            onClick={() => update(action.status)}
            className={cn("inline-flex min-h-9 items-center gap-2 px-3 text-[8px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-45", action.className)}
          >
            {busy === action.status ? <LoaderCircle className="h-3 w-3 animate-spin" /> : action.status === "confirmed" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {action.label}
          </button>
        ))}
      </div>
      {message ? <p role="alert" className="mt-2 max-w-xs text-xs leading-5 text-[#8d433b]">{message}</p> : null}
    </div>
  );
}
