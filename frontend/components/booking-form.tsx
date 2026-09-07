"use client";

import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import {
  checkBookingAvailability,
  ClientApiError,
  submitBooking,
} from "@/lib/api/client";
import { services } from "@/lib/data";
import { cn } from "@/lib/utils";

export function BookingForm() {
  const [selectedService, setSelectedService] = useState(services[0].name);
  const [state, setState] = useState<{
    status: "idle" | "checking" | "submitting" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const date = String(data.get("date") ?? "");
    const time = String(data.get("time") ?? "");
    const dateTime = `${date}T${time}:00+06:00`;

    try {
      setState({ status: "checking", message: "Checking studio availability…" });
      const availability = await checkBookingAvailability(dateTime);
      if (!availability.available) {
        setState({
          status: "error",
          message: availability.message ?? "That time is unavailable. Please choose another.",
        });
        return;
      }

      setState({ status: "submitting", message: "Submitting your booking request…" });
      const result = await submitBooking({
        serviceType: selectedService,
        dateTime,
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        company: String(data.get("company") ?? "") || undefined,
        notes: String(data.get("notes") ?? "") || undefined,
      });
      form.reset();
      setSelectedService(services[0].name);
      setState({ status: "success", message: result.message });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof ClientApiError
          ? error.message
          : "Something went wrong. Please try again.",
      });
    }
  }

  const busy = state.status === "checking" || state.status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="space-y-14">
      <fieldset>
        <legend className="eyebrow">01 — Select a service</legend>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {services.map((service) => {
            const active = selectedService === service.name;
            return (
              <label key={service.slug} className={cn(
                "relative cursor-pointer border p-5 transition duration-300",
                active ? "border-ink bg-ink text-paper" : "border-ink/15 bg-paper hover:border-ink/45",
              )}>
                <input
                  type="radio"
                  name="serviceType"
                  value={service.name}
                  checked={active}
                  onChange={() => setSelectedService(service.name)}
                  className="sr-only"
                />
                <span className="block pr-8 font-serif text-xl">{service.name}</span>
                <span className={cn("mt-2 block text-xs", active ? "text-paper/55" : "text-ink/45")}>{service.number}</span>
                {active ? <Check className="absolute right-4 top-4 h-4 w-4" /> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow">02 — Preferred appointment</legend>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <Field label="Preferred date" htmlFor="booking-date">
            <Input id="booking-date" name="date" type="date" required />
          </Field>
          <Field label="Preferred time" htmlFor="booking-time">
            <Input id="booking-time" name="time" type="time" required />
          </Field>
        </div>
        <p className="mt-4 text-xs leading-5 text-ink/45">Times are shown in Dhaka studio time (UTC+6) and remain subject to confirmation.</p>
      </fieldset>

      <fieldset>
        <legend className="eyebrow">03 — Your details</legend>
        <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2">
          <Field label="Name" htmlFor="booking-name">
            <Input id="booking-name" name="name" autoComplete="name" placeholder="Your full name" maxLength={500} required />
          </Field>
          <Field label="Email" htmlFor="booking-email">
            <Input id="booking-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" maxLength={320} required />
          </Field>
          <Field label="Phone" htmlFor="booking-phone">
            <Input id="booking-phone" name="phone" type="tel" autoComplete="tel" placeholder="Your phone number" maxLength={50} required />
          </Field>
          <Field label="Company" htmlFor="booking-company">
            <Input id="booking-company" name="company" autoComplete="organization" placeholder="Brand or company name" maxLength={500} />
          </Field>
          <Field label="Project notes" htmlFor="booking-notes" className="sm:col-span-2">
            <Textarea id="booking-notes" name="notes" placeholder="Tell us about products, quantities, usage, or creative direction." maxLength={5000} />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-col gap-5 border-t border-ink/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-ink/45">Submitting a request does not confirm the appointment. The studio will review availability first.</p>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>{state.status === "checking" ? "Checking time" : "Submitting"} <LoaderCircle className="h-4 w-4 animate-spin" /></>
          ) : (
            <>Request booking <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
      </div>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={cn(
            "border-l-2 pl-4 text-sm",
            state.status === "error" ? "border-[#9b4a42] text-[#7a342e]" : "border-bronze text-ink/65",
          )}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
