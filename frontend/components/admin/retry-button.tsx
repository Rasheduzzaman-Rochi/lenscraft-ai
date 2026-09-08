"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()} className="inline-flex items-center gap-2 border border-ink/15 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] transition hover:border-ink/40">
      <RefreshCw className="h-3.5 w-3.5" /> {label}
    </button>
  );
}