"use client";

import { ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { services } from "@/lib/data";

export function ContactForm() {
  const [complete, setComplete] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) setComplete(true);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
      <Field label="Name" htmlFor="contact-name">
        <Input id="contact-name" name="name" autoComplete="name" placeholder="Your full name" required />
      </Field>
      <Field label="Email" htmlFor="contact-email">
        <Input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
      </Field>
      <Field label="Phone" htmlFor="contact-phone">
        <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" placeholder="Your phone number" />
      </Field>
      <Field label="Company" htmlFor="contact-company">
        <Input id="contact-company" name="company" autoComplete="organization" placeholder="Brand or company name" />
      </Field>
      <Field label="Project type" htmlFor="contact-project" className="sm:col-span-2">
        <Select id="contact-project" name="projectType" defaultValue="" required>
          <option value="" disabled>Select a photography service</option>
          {services.map((service) => <option key={service.slug} value={service.name}>{service.name}</option>)}
          <option value="Other">Something else</option>
        </Select>
      </Field>
      <Field label="Tell us about the project" htmlFor="contact-message" className="sm:col-span-2">
        <Textarea id="contact-message" name="message" placeholder="Scope, timing, quantities, references, and anything else we should know." required />
      </Field>
      <div className="flex flex-col items-start gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-ink/45">
          We respond to new project enquiries within one business day.
        </p>
        <Button type="submit">Send enquiry <ArrowRight className="h-4 w-4" /></Button>
      </div>
      {complete ? (
        <p role="status" className="border-l-2 border-bronze pl-4 text-sm text-ink/65 sm:col-span-2">
          Preview only — your enquiry details are complete, but no request has been sent.
        </p>
      ) : null}
    </form>
  );
}
