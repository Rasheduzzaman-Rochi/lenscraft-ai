"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Resource = "booking" | "lead";

export function DeleteAdminRecord({ id, resource }: { id: string; resource: Resource }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    const accepted = window.confirm(
      `Permanently delete this ${resource}? This action cannot be undone.`,
    );
    if (!accepted) return;

    setDeleting(true);
    setError(undefined);
    try {
      const collection = resource === "booking" ? "bookings" : "leads";
      const response = await fetch(`/api/admin/${collection}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null) as { message?: unknown } | null;
      if (!response.ok) {
        setError(
          typeof payload?.message === "string"
            ? payload.message
            : `The ${resource} could not be deleted.`,
        );
        return;
      }
      router.push(`/admin/${collection}`);
      router.refresh();
    } catch {
      setError(`The ${resource} could not be deleted. Please try again.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 border border-[#b36a60]/25 bg-[#b36a60]/[0.06] p-6">
      <p className="eyebrow text-[#85483f]">Permanent action</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5 text-ink/55">
          Delete this {resource} from the studio records. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={deleting}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border border-[#8d433b]/35 px-4 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#8d433b] transition hover:border-[#8d433b] hover:bg-[#8d433b] hover:text-paper disabled:cursor-wait disabled:opacity-50"
        >
          {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {deleting ? "Deleting" : `Delete ${resource}`}
        </button>
      </div>
      {error ? <p role="alert" className="mt-4 text-xs leading-5 text-[#8d433b]">{error}</p> : null}
    </div>
  );
}
