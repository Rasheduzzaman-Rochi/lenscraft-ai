"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy = false,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="w-[calc(100%-2rem)] max-w-lg border border-ink/15 bg-paper p-0 text-ink shadow-soft backdrop:bg-ink/50"
    >
      <div className="p-6 sm:p-8">
        <p className={cn("eyebrow", destructive && "text-[#85483f]")}>{destructive ? "Permanent action" : "Please confirm"}</p>
        <h2 id={titleId} className="mt-3 font-serif text-3xl leading-tight">{title}</h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-ink/60">{children}</div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center border border-ink/15 px-5 text-[9px] font-semibold uppercase tracking-[0.16em] transition hover:border-ink/40 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 px-5 text-[9px] font-semibold uppercase tracking-[0.16em] text-paper transition disabled:cursor-wait disabled:opacity-60",
              destructive ? "bg-[#8d433b] hover:bg-[#6f342e]" : "bg-ink hover:bg-bronze",
            )}
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
