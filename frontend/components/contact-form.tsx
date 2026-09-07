"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { ClientApiError, submitContact } from "@/lib/api/client";
import { services } from "@/lib/data";

export function ContactForm() {
  const [state, setState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    setState({ status: "loading" });
    try {
      const result = await submitContact({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? "") || undefined,
        company: String(data.get("company") ?? "") || undefined,
        projectType: String(data.get("projectType") ?? ""),
        message: String(data.get("message") ?? ""),
      });
      form.reset();
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

  return (
    <form onSubmit={handleSubmit} className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
      <Field label="Name" htmlFor="contact-name">
        <Input id="contact-name" name="name" autoComplete="name" placeholder="Your full name" maxLength={500} required />
      </Field>
      <Field label="Email" htmlFor="contact-email">
        <Input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" maxLength={320} required />
      </Field>
      <Field label="Phone" htmlFor="contact-phone">
        <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" placeholder="Your phone number" maxLength={50} />
      </Field>
      <Field label="Company" htmlFor="contact-company">
        <Input id="contact-company" name="company" autoComplete="organization" placeholder="Brand or company name" maxLength={500} />
      </Field>
      <Field label="Project type" htmlFor="contact-project" className="sm:col-span-2">
        <Select id="contact-project" name="projectType" defaultValue="" required>
          <option value="" disabled>Select a photography service</option>
          {services.map((service) => <option key={service.slug} value={service.name}>{service.name}</option>)}
          <option value="Other">Something else</option>
        </Select>
      </Field>
      <Field label="Tell us about the project" htmlFor="contact-message" className="sm:col-span-2">
        <Textarea id="contact-message" name="message" placeholder="Scope, timing, quantities, references, and anything else we should know." maxLength={1000} required />
      </Field>
      <div className="flex flex-col items-start gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-ink/45">
          We respond to new project enquiries within one business day.
        </p>
        <Button type="submit" disabled={state.status === "loading"}>
          {state.status === "loading" ? (
            <>Sending <LoaderCircle className="h-4 w-4 animate-spin" /></>
          ) : (
            <>Send enquiry <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
      </div>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`border-l-2 pl-4 text-sm sm:col-span-2 ${
            state.status === "error" ? "border-[#9b4a42] text-[#7a342e]" : "border-bronze text-ink/65"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
