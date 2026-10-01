"use client";

import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useAdminMutation } from "@/components/admin/use-admin-mutation";
import { adminPrimaryButtonClass } from "@/components/admin/ui";

export function AdminField({ label, htmlFor, hint, children, className }: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="eyebrow block">{label}</label>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-2 text-xs leading-5 text-ink/45">{hint}</p> : null}
    </div>
  );
}

export function FormFeedback({ error, success }: { error?: string; success?: string }) {
  if (error) return <p role="alert" className="text-sm leading-6 text-[#8d433b]">{error}</p>;
  if (success) {
    return <p role="status" className="inline-flex items-center gap-2 text-sm text-[#39523a]"><Check className="h-4 w-4" /> {success}</p>;
  }
  return null;
}

export function SubmitButton({ busy, label, busyLabel, disabled }: {
  busy: boolean;
  label: string;
  busyLabel: string;
  disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={busy || disabled} className={adminPrimaryButtonClass}>
      {busy ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {busyLabel}</> : label}
    </button>
  );
}

export function Warning({ children }: { children: React.ReactNode }) {
  return <div className="border border-[#b08b4b]/35 bg-[#eee3cc]/60 p-4 text-xs leading-5 text-[#765b2c]">{children}</div>;
}

/** Delete one record after a confirmation that names it explicitly. */
export function DeleteRecordButton({ endpoint, resource, recordLabel, redirectTo, consequences }: {
  endpoint: string;
  resource: string;
  recordLabel: string;
  redirectTo: string;
  consequences: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAdminMutation();

  async function confirm() {
    const result = await run(endpoint, "DELETE", undefined, {
      success: `${resource} deleted.`,
      fallbackError: `The ${resource.toLowerCase()} could not be deleted.`,
      redirect: () => redirectTo,
    });
    if (result !== undefined) setOpen(false);
  }

  return (
    <div className="mt-6 border border-[#b36a60]/25 bg-[#b36a60]/[0.06] p-5 sm:p-6">
      <p className="eyebrow text-[#85483f]">Permanent action</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5 text-ink/55">Delete this {resource.toLowerCase()} from the studio records. This cannot be undone.</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border border-[#8d433b]/35 px-4 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#8d433b] transition hover:border-[#8d433b] hover:bg-[#8d433b] hover:text-paper"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete {resource.toLowerCase()}
        </button>
      </div>
      {error && !open ? <p role="alert" className="mt-4 text-xs leading-5 text-[#8d433b]">{error}</p> : null}
      <ConfirmDialog
        open={open}
        destructive
        busy={busy}
        title={`Delete “${recordLabel}”?`}
        confirmLabel={busy ? "Deleting" : `Delete ${resource.toLowerCase()}`}
        onConfirm={() => void confirm()}
        onCancel={() => setOpen(false)}
      >
        {consequences}
        {error ? <p role="alert" className="text-[#8d433b]">{error}</p> : null}
      </ConfirmDialog>
    </div>
  );
}
