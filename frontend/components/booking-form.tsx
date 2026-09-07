"use client";

import { ArrowLeft, ArrowRight, CalendarCheck, Check, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { checkBookingAvailability, ClientApiError, submitBooking } from "@/lib/api/client";
import { services } from "@/lib/data";
import { cn } from "@/lib/utils";

const steps = ["Service", "Date & time", "Availability", "Your details", "Review"];
const initialDraft = {
  service: services[0].name,
  date: "",
  time: "",
  name: "",
  email: "",
  phone: "",
  company: "",
  notes: "",
};

export function BookingForm() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(initialDraft);
  const [availability, setAvailability] = useState<"unchecked" | "checking" | "available" | "unavailable">("unchecked");
  const [state, setState] = useState<{ status: "idle" | "submitting" | "success" | "error"; message?: string }>({ status: "idle" });
  const dateTime = draft.date && draft.time ? `${draft.date}T${draft.time}:00+06:00` : "";

  function update<K extends keyof typeof draft>(key: K, value: typeof draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setState({ status: "idle" });
    if (key === "date" || key === "time") setAvailability("unchecked");
  }

  async function checkAvailability() {
    if (!dateTime) return;
    setAvailability("checking");
    setState({ status: "idle", message: "Checking the studio calendar…" });
    try {
      const result = await checkBookingAvailability(dateTime);
      if (result.available) {
        setAvailability("available");
        setState({ status: "idle", message: result.message ?? "This time is available to request." });
      } else {
        setAvailability("unavailable");
        setState({ status: "error", message: result.message ?? "That time is unavailable. Please choose another." });
      }
    } catch (error) {
      setAvailability("unchecked");
      setState({ status: "error", message: error instanceof ClientApiError ? error.message : "We could not check that time. Please try again." });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    if (step === 1 || step === 2 || step === 4) {
      setStep((current) => current + 1);
      setState({ status: "idle" });
      return;
    }
    if (step === 3) {
      if (availability === "available") {
        setStep(4);
        setState({ status: "idle" });
      } else {
        await checkAvailability();
      }
      return;
    }

    setState({ status: "submitting", message: "Sending your request to the studio…" });
    try {
      const result = await submitBooking({
        serviceType: draft.service,
        dateTime,
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        company: draft.company || undefined,
        notes: draft.notes || undefined,
      });
      setState({ status: "success", message: result.message });
    } catch (error) {
      setState({ status: "error", message: error instanceof ClientApiError ? error.message : "Something went wrong. Please try again." });
    }
  }

  function goBack() {
    setState({ status: "idle" });
    setStep((current) => Math.max(1, current - 1));
  }

  if (state.status === "success") {
    return (
      <div className="py-8 text-center sm:py-14">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-bronze/35 bg-paper text-bronze"><CalendarCheck className="h-8 w-8" strokeWidth={1.2} /></div>
        <p className="eyebrow mt-8">Request received</p>
        <h3 className="mx-auto mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-5xl">Your preferred time is with our studio team.</h3>
        <p className="mx-auto mt-6 max-w-lg text-sm leading-6 text-ink/55">{state.message}</p>
        <Button type="button" variant="outline" className="mt-8" onClick={() => { setDraft(initialDraft); setStep(1); setAvailability("unchecked"); setState({ status: "idle" }); }}>Make another request</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <ol className="grid grid-cols-5 border-y border-ink/15" aria-label="Booking progress">
        {steps.map((label, index) => {
          const number = index + 1;
          const active = number === step;
          const complete = number < step;
          return (
            <li key={label} className={cn("relative border-r border-ink/10 px-2 py-4 text-center last:border-r-0 sm:px-3", active && "bg-ink text-paper")} aria-current={active ? "step" : undefined}>
              <span className={cn("mx-auto grid h-6 w-6 place-items-center rounded-full border text-[8px]", active ? "border-paper/30" : complete ? "border-bronze bg-bronze text-paper" : "border-ink/15 text-ink/35")}>{complete ? <Check className="h-3 w-3" /> : `0${number}`}</span>
              <span className={cn("mt-2 hidden text-[7px] font-semibold uppercase tracking-[0.12em] sm:block", active ? "text-paper/60" : "text-ink/35")}>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="min-h-[430px] py-10 sm:py-12">
        {step === 1 ? (
          <fieldset>
            <legend className="eyebrow">Step 01 — Choose your photography service</legend>
            <h3 className="mt-4 font-serif text-3xl sm:text-4xl">What are we creating?</h3>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {services.map((service) => {
                const active = draft.service === service.name;
                return (
                  <label key={service.slug} className={cn("relative cursor-pointer border p-5 transition duration-300", active ? "border-ink bg-ink text-paper shadow-soft" : "border-ink/15 bg-paper hover:-translate-y-0.5 hover:border-ink/45")}>
                    <input type="radio" name="serviceType" value={service.name} checked={active} onChange={() => update("service", service.name)} className="sr-only" />
                    <span className="block pr-8 font-serif text-xl">{service.name}</span>
                    <span className={cn("mt-2 block text-[8px] uppercase tracking-[0.16em]", active ? "text-paper/45" : "text-ink/35")}>Service {service.number}</span>
                    {active ? <Check className="absolute right-4 top-4 h-4 w-4 text-clay" /> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend className="eyebrow">Step 02 — Select your preferred appointment</legend>
            <h3 className="mt-4 font-serif text-3xl sm:text-4xl">When would you like to begin?</h3>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <Field label="Preferred date" htmlFor="booking-date"><Input id="booking-date" name="date" type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} required /></Field>
              <Field label="Preferred time" htmlFor="booking-time"><Input id="booking-time" name="time" type="time" value={draft.time} onChange={(event) => update("time", event.target.value)} required /></Field>
            </div>
            <div className="mt-8 border-l border-bronze bg-paper px-5 py-4"><p className="text-xs leading-5 text-ink/50">Times use Dhaka studio time (UTC+6). Your appointment remains a request until the studio confirms it.</p></div>
          </fieldset>
        ) : null}

        {step === 3 ? (
          <div>
            <p className="eyebrow">Step 03 — Check studio availability</p>
            <h3 className="mt-4 font-serif text-3xl sm:text-4xl">Let’s check the calendar.</h3>
            <div className="mt-9 border border-ink/15 bg-paper p-6 sm:p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <div><p className="eyebrow">Service</p><p className="mt-2 font-serif text-2xl">{draft.service}</p></div>
                <div><p className="eyebrow">Preferred time</p><p className="mt-2 font-serif text-2xl">{draft.date} · {draft.time}</p></div>
              </div>
              <div className={cn("mt-7 flex items-center gap-4 border-t border-ink/10 pt-6", availability === "available" && "text-[#426044]", availability === "unavailable" && "text-[#8d433b]")}>
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", availability === "available" ? "border-[#426044]/30 bg-[#426044]/10" : "border-ink/15")}>
                  {availability === "checking" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : availability === "available" ? <Check className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
                </span>
                <p className="text-sm leading-6">{state.message ?? "Check this exact date and time before sharing your details."}</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <fieldset>
            <legend className="eyebrow">Step 04 — Customer details</legend>
            <h3 className="mt-4 font-serif text-3xl sm:text-4xl">Tell us who we’re creating for.</h3>
            <div className="mt-9 grid gap-x-8 gap-y-8 sm:grid-cols-2">
              <Field label="Name" htmlFor="booking-name"><Input id="booking-name" name="name" autoComplete="name" value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Your full name" maxLength={500} required /></Field>
              <Field label="Email" htmlFor="booking-email"><Input id="booking-email" name="email" type="email" autoComplete="email" value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="you@company.com" maxLength={320} required /></Field>
              <Field label="Phone" htmlFor="booking-phone"><Input id="booking-phone" name="phone" type="tel" autoComplete="tel" value={draft.phone} onChange={(event) => update("phone", event.target.value)} placeholder="Your phone number" maxLength={50} required /></Field>
              <Field label="Company" htmlFor="booking-company"><Input id="booking-company" name="company" autoComplete="organization" value={draft.company} onChange={(event) => update("company", event.target.value)} placeholder="Brand or company name" maxLength={500} /></Field>
              <Field label="Project notes" htmlFor="booking-notes" className="sm:col-span-2"><Textarea id="booking-notes" name="notes" value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Products, quantities, usage, or creative direction." maxLength={5000} /></Field>
            </div>
          </fieldset>
        ) : null}

        {step === 5 ? (
          <div>
            <p className="eyebrow">Step 05 — Review your request</p>
            <h3 className="mt-4 font-serif text-3xl sm:text-4xl">One final look.</h3>
            <dl className="mt-9 divide-y divide-ink/10 border-y border-ink/15 bg-paper px-5 sm:px-8">
              {[
                ["Service", draft.service], ["Appointment", `${draft.date} at ${draft.time} (UTC+6)`], ["Customer", draft.name],
                ["Contact", `${draft.email} · ${draft.phone}`], ["Company", draft.company || "Not supplied"], ["Notes", draft.notes || "No additional notes"],
              ].map(([label, value]) => <div key={label} className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr]"><dt className="eyebrow">{label}</dt><dd className="text-sm leading-6 text-ink/65">{value}</dd></div>)}
            </dl>
            <p className="mt-5 text-xs leading-5 text-ink/45">Submitting this request does not confirm the appointment. LensCraft Studio will review it and contact you.</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-ink/15 pt-7 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={goBack} disabled={step === 1 || state.status === "submitting"} className="inline-flex items-center justify-center gap-2 px-2 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45 transition hover:text-ink disabled:invisible"><ArrowLeft className="h-4 w-4" /> Back</button>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <Button type="submit" disabled={availability === "checking" || state.status === "submitting"}>
            {availability === "checking" ? <>Checking time <LoaderCircle className="h-4 w-4 animate-spin" /></> : state.status === "submitting" ? <>Submitting <LoaderCircle className="h-4 w-4 animate-spin" /></> : step === 3 && availability !== "available" ? <>Check availability <CalendarCheck className="h-4 w-4" /></> : step === 5 ? <>Submit booking request <ArrowRight className="h-4 w-4" /></> : <>Continue <ArrowRight className="h-4 w-4" /></>}
          </Button>
          {state.status === "error" && step !== 3 ? <p role="alert" className="max-w-md text-right text-xs leading-5 text-[#8d433b]">{state.message}</p> : null}
        </div>
      </div>
    </form>
  );
}
