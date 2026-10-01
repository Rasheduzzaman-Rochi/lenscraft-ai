"use client";

import { FormEvent, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminField, FormFeedback, SubmitButton, Warning } from "@/components/admin/form-parts";
import { adminInputClass } from "@/components/admin/ui";
import { useAdminMutation } from "@/components/admin/use-admin-mutation";
import type { AdminCompanySettings, BusinessHours } from "@/lib/admin/types";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TAX = /^\d{1,3}(\.\d{1,4})?$/;

type DayState = { mode: "open" | "closed" | "unset"; open: string; close: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function initialDays(hours: BusinessHours): Record<string, DayState> {
  return Object.fromEntries(WEEKDAYS.map((day) => {
    const value = hours[day];
    if (!value) return [day, { mode: "unset", open: "09:00", close: "18:00" }];
    if (value.closed === true) return [day, { mode: "closed", open: "09:00", close: "18:00" }];
    return [day, { mode: "open", open: String(value.open ?? "09:00"), close: String(value.close ?? "18:00") }];
  }));
}

function timeZones(current: string) {
  try {
    return [...new Set([current, ...Intl.supportedValuesOf("timeZone")])].sort();
  } catch {
    return [current];
  }
}

export function CompanySettingsForm({ settings, serviceNames }: { settings: AdminCompanySettings; serviceNames: string[] }) {
  const booking = record(settings.settings.booking);
  const durations = record(booking.slot_duration_minutes);
  const [currency, setCurrency] = useState(settings.currency);
  const [timeZone, setTimeZone] = useState(settings.timezone);
  const [taxRate, setTaxRate] = useState(String(Number(settings.tax_rate)));
  const [days, setDays] = useState(() => initialDays(settings.business_hours));
  const [advanceDays, setAdvanceDays] = useState(booking.minimum_advance_days === undefined ? "" : String(booking.minimum_advance_days));
  const durationKeys = useMemo(() => [...new Set([...Object.keys(durations), ...serviceNames])], [durations, serviceNames]);
  const [slotDurations, setSlotDurations] = useState<Record<string, string>>(() => Object.fromEntries(
    durationKeys.map((key) => [key, durations[key] === undefined ? "" : String(durations[key])]),
  ));
  const [pending, setPending] = useState<{ body: Record<string, unknown>; changes: string[] }>();
  const { busy, error, success, run, setError } = useAdminMutation();
  const zones = useMemo(() => timeZones(settings.timezone), [settings.timezone]);

  function build() {
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw new Error("Currency must be a three-letter ISO code such as USD.");
    if (!TAX.test(taxRate.trim()) || Number(taxRate) > 100) throw new Error("Tax rate must be a percentage from 0 to 100 with at most 4 decimals.");

    const hours: Record<string, unknown> = {};
    for (const [day, value] of Object.entries(settings.business_hours)) if (!WEEKDAYS.includes(day)) hours[day] = value;
    for (const day of WEEKDAYS) {
      const state = days[day];
      const original = record(settings.business_hours[day]);
      if (state.mode === "unset") continue;
      if (state.mode === "closed") {
        const rest = Object.fromEntries(Object.entries(original).filter(([key]) => key !== "open" && key !== "close"));
        hours[day] = { ...rest, closed: true };
        continue;
      }
      if (!TIME.test(state.open) || !TIME.test(state.close) || state.open >= state.close) {
        throw new Error(`Check ${day}: opening time must be before closing time.`);
      }
      const rest = Object.fromEntries(Object.entries(original).filter(([key]) => key !== "closed"));
      hours[day] = { ...rest, open: state.open, close: state.close };
    }
    const orderedHours = Object.fromEntries([
      ...Object.keys(settings.business_hours).filter((key) => key in hours).map((key) => [key, hours[key]]),
      ...Object.keys(hours).filter((key) => !(key in settings.business_hours)).map((key) => [key, hours[key]]),
    ]);

    const nextDurations: Record<string, number> = {};
    for (const key of durationKeys) {
      const text = slotDurations[key]?.trim();
      if (!text) continue;
      if (!/^\d{1,4}$/.test(text) || Number(text) < 5 || Number(text) > 1440) {
        throw new Error(`Slot duration for ${key} must be 5 to 1440 minutes.`);
      }
      nextDurations[key] = Number(text);
    }
    const nextBooking: Record<string, unknown> = { ...booking };
    if (advanceDays.trim()) {
      if (!/^\d{1,3}$/.test(advanceDays.trim()) || Number(advanceDays) > 365) {
        throw new Error("Minimum advance days must be a whole number from 0 to 365.");
      }
      nextBooking.minimum_advance_days = Number(advanceDays);
    } else delete nextBooking.minimum_advance_days;
    if (Object.keys(nextDurations).length) nextBooking.slot_duration_minutes = nextDurations;
    else delete nextBooking.slot_duration_minutes;
    const nextSettings: Record<string, unknown> = { ...settings.settings };
    if (Object.keys(nextBooking).length) nextSettings.booking = nextBooking;
    else delete nextSettings.booking;

    const body: Record<string, unknown> = {};
    const changes: string[] = [];
    if (code !== settings.currency) { body.currency = code; changes.push(`Currency: ${settings.currency} → ${code}`); }
    if (timeZone !== settings.timezone) { body.timezone = timeZone; changes.push(`Time zone: ${settings.timezone} → ${timeZone}`); }
    if (Number(taxRate) !== Number(settings.tax_rate)) { body.tax_rate = taxRate.trim(); changes.push(`Tax rate: ${Number(settings.tax_rate)}% → ${Number(taxRate)}%`); }
    if (JSON.stringify(orderedHours) !== JSON.stringify(settings.business_hours)) { body.business_hours = orderedHours; changes.push("Business hours"); }
    if (JSON.stringify(nextBooking) !== JSON.stringify(booking)) { body.settings = nextSettings; changes.push("Booking rules (advance notice or slot durations)"); }
    return { body, changes };
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = build();
      if (!next.changes.length) {
        setError("There are no changes to save.");
        return;
      }
      setError(undefined);
      setPending(next);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Some settings are invalid.");
    }
  }

  async function save() {
    if (!pending) return;
    const result = await run("/api/admin/settings", "PATCH", { ...pending.body, expected_updated_at: settings.updated_at }, {
      success: "Settings saved.", fallbackError: "The settings could not be saved.",
    });
    if (result !== undefined) setPending(undefined);
  }

  const dayInput = (day: string, key: "open" | "close") => (
    <input
      type="time"
      aria-label={`${day} ${key === "open" ? "opening" : "closing"} time`}
      value={days[day][key]}
      disabled={days[day].mode !== "open"}
      onChange={(event) => setDays((current) => ({ ...current, [day]: { ...current[day], [key]: event.target.value } }))}
      className={`${adminInputClass} h-11`}
    />
  );

  return (
    <form onSubmit={review} className="space-y-10">
      <Warning>
        The voice agent&apos;s booking rules can read these values. Changes apply to new conversations as soon as they are saved.
        Existing bookings keep their stored appointment times.
      </Warning>

      <section>
        <p className="eyebrow">Studio</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          <AdminField label="Currency" htmlFor="settings-currency" hint="ISO 4217 code. Prices are not converted.">
            <input id="settings-currency" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} required className={adminInputClass} />
          </AdminField>
          <AdminField label="Time zone" htmlFor="settings-timezone" hint="Used to show and enter appointment times.">
            <select id="settings-timezone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className={adminInputClass}>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </AdminField>
          <AdminField label="Tax rate (%)" htmlFor="settings-tax" hint="Percentage points: 7.5 means 7.5%.">
            <input id="settings-tax" inputMode="decimal" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} required className={adminInputClass} />
          </AdminField>
        </div>
      </section>

      <section>
        <p className="eyebrow">Business hours</p>
        <div className="mt-5 divide-y divide-ink/10 border border-ink/10">
          {WEEKDAYS.map((day) => (
            <div key={day} className="grid gap-3 p-4 sm:grid-cols-[140px_160px_1fr] sm:items-center">
              <p className="text-sm capitalize">{day}</p>
              <select
                aria-label={`${day} availability`}
                value={days[day].mode}
                onChange={(event) => setDays((current) => ({ ...current, [day]: { ...current[day], mode: event.target.value as DayState["mode"] } }))}
                className={`${adminInputClass} h-11`}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="unset">Not set</option>
              </select>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {dayInput(day, "open")}<span className="text-xs text-ink/40">to</span>{dayInput(day, "close")}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="eyebrow">Booking rules</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          <AdminField label="Minimum advance days" htmlFor="settings-advance" hint="Earliest bookable day, counted from today.">
            <input id="settings-advance" inputMode="numeric" value={advanceDays} onChange={(event) => setAdvanceDays(event.target.value)} className={adminInputClass} />
          </AdminField>
        </div>
        <p className="mt-8 text-sm text-ink/60">Slot duration per service (minutes). Leave blank for no duration rule.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {durationKeys.map((key) => (
            <AdminField key={key} label={key} htmlFor={`duration-${key}`} hint={serviceNames.includes(key) ? undefined : "No service currently uses this exact name."}>
              <input
                id={`duration-${key}`}
                inputMode="numeric"
                value={slotDurations[key] ?? ""}
                onChange={(event) => setSlotDurations((current) => ({ ...current, [key]: event.target.value }))}
                className={adminInputClass}
              />
            </AdminField>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <FormFeedback error={pending ? undefined : error} success={success} />
        <SubmitButton busy={busy} label="Review and save" busyLabel="Saving" />
      </div>

      <ConfirmDialog
        open={pending !== undefined}
        busy={busy}
        title="Save studio settings?"
        confirmLabel={busy ? "Saving" : "Save settings"}
        onConfirm={() => void save()}
        onCancel={() => setPending(undefined)}
      >
        <p>These changes can affect how the voice agent quotes and offers booking times:</p>
        <ul className="list-disc space-y-1 pl-5">{pending?.changes.map((change) => <li key={change}>{change}</li>)}</ul>
        {error ? <p role="alert" className="text-[#8d433b]">{error}</p> : null}
      </ConfirmDialog>
    </form>
  );
}
