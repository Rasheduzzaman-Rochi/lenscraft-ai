import { ArrowLeft, ChevronLeft, ChevronRight, CircleAlert, Search } from "lucide-react";
import Link from "next/link";

import { RetryButton } from "@/components/admin/retry-button";
import { cn } from "@/lib/utils";

export const ADMIN_PAGE_SIZE = 25;

export const adminInputClass =
  "h-12 w-full border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-ink disabled:cursor-not-allowed disabled:opacity-60";

export const adminPrimaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-bronze disabled:cursor-wait disabled:opacity-50";

export const adminSecondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border border-ink/15 bg-paper px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-50";

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 border-b border-ink/10 pb-9 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 break-words font-serif text-4xl tracking-[-0.03em] sm:text-6xl">{title}</h1>
        {description ? <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/50">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45 hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

export function Panel({ eyebrow, title, children, className }: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-ink/10 bg-paper p-5 sm:p-8", className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      {title ? <h2 className="mt-2 font-serif text-2xl sm:text-3xl">{title}</h2> : null}
      {children}
    </section>
  );
}

export function ErrorPanel({ title, message, retry = true }: { title: string; message: string; retry?: boolean }) {
  return (
    <section className="mt-8 border border-[#b36a60]/30 bg-[#b36a60]/10 p-6 sm:p-7" role="alert">
      <div className="flex items-start gap-4">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#85483f]" />
        <div>
          <p className="eyebrow text-[#85483f]">Data unavailable</p>
          <h2 className="mt-3 font-serif text-2xl sm:text-3xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/55">{message}</p>
          {retry ? <div className="mt-5"><RetryButton /></div> : null}
        </div>
      </div>
    </section>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="mt-6 border border-ink/10 bg-paper px-6 py-14 text-center sm:px-7 sm:py-16">
      <p className="font-serif text-3xl">{title}</p>
      <p className="mt-3 text-sm text-ink/45">{message}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

const badgeTones = {
  positive: "bg-[#dce8db] text-[#39523a]",
  warning: "bg-[#eee3cc] text-[#765b2c]",
  negative: "bg-[#eedbd7] text-[#7b4038]",
  neutral: "bg-bone text-ink/55",
  muted: "bg-ink/5 text-ink/45",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof badgeTones }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em]", badgeTones[tone])}>
      {children}
    </span>
  );
}

export function bookingTone(status: string): keyof typeof badgeTones {
  const value = status.trim().toLowerCase();
  return value === "confirmed" ? "positive" : value === "pending" ? "warning" : value === "rejected" ? "negative" : "muted";
}

/** GET form for list filters: works without client JavaScript and keeps filters in the URL. */
export function FilterBar({ action, search, placeholder, children, resetHref }: {
  action: string;
  search?: string;
  placeholder: string;
  children?: React.ReactNode;
  resetHref?: string;
}) {
  return (
    <form action={action} method="get" className="mt-7 grid gap-3 border border-ink/10 bg-paper p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5" role="search">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(auto-fit,minmax(150px,1fr))]">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <input name="search" defaultValue={search} placeholder={placeholder} maxLength={100} className={cn(adminInputClass, "pl-9")} />
        </label>
        {children}
      </div>
      <div className="flex gap-2">
        <button type="submit" className={adminPrimaryButtonClass}>Apply</button>
        {resetHref ? <Link href={resetHref} className={adminSecondaryButtonClass}>Reset</Link> : null}
      </div>
    </form>
  );
}

export function Pagination({ basePath, params, page, total, pageSize = ADMIN_PAGE_SIZE }: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize?: number;
}) {
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return `${basePath}${text ? `?${text}` : ""}`;
  };
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const linkClass = "grid h-10 w-10 place-items-center border border-ink/15 bg-paper";
  return (
    <div className="mt-7 flex items-center justify-between gap-4 border-t border-ink/10 pt-6">
      <p className="text-[9px] uppercase tracking-[0.16em] text-ink/40">Showing {first}–{last} of {total}</p>
      <div className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={linkClass} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Link> : <span className={cn(linkClass, "opacity-30")} aria-hidden><ChevronLeft className="h-4 w-4" /></span>}
        {last < total ? <Link href={href(page + 1)} className={linkClass} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Link> : <span className={cn(linkClass, "opacity-30")} aria-hidden><ChevronRight className="h-4 w-4" /></span>}
      </div>
    </div>
  );
}

export function pageNumber(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function DetailItem({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 break-words text-sm leading-6 text-ink/70">{children}</dd>
    </div>
  );
}
