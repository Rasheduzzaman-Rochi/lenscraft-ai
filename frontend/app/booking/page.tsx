import type { Metadata } from "next";
import { CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react";

import { BookingForm } from "@/components/booking-form";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Request a Booking",
  description: "Request a photography booking with LensCraft Studio.",
};

const notes = [
  { icon: CalendarCheck, title: "Request your time", text: "Choose the service, date, and time that suit your production." },
  { icon: MessageCircle, title: "We review the brief", text: "We confirm scope and studio availability with you directly." },
  { icon: ShieldCheck, title: "Your slot is confirmed", text: "A booking is secured only after you receive studio confirmation." },
];

export default function BookingPage() {
  return (
    <>
      <PageHero
        eyebrow="Bookings — 04"
        title="Reserve the right moment."
        intro="Start with a preferred appointment. We will review availability and shape the production details with you."
      />
      <section className="section-space bg-paper">
        <div className="page-shell grid gap-16 lg:grid-cols-[0.55fr_1.45fr] lg:gap-24">
          <Reveal>
            <aside className="lg:sticky lg:top-36">
              <p className="eyebrow">What happens next</p>
              <div className="mt-7 space-y-8">
                {notes.map(({ icon: Icon, title, text }, index) => (
                  <div key={title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15">
                      <Icon className="h-4 w-4 text-bronze" strokeWidth={1.4} />
                    </div>
                    <div>
                      <p className="font-serif text-xl">{title}</p>
                      <p className="mt-2 text-xs leading-5 text-ink/50">{text}</p>
                      <p className="mt-2 text-[8px] uppercase tracking-[0.2em] text-ink/30">Step 0{index + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="border border-ink/15 bg-bone p-6 sm:p-10 lg:p-14">
              <h2 className="font-serif text-3xl sm:text-4xl">Booking request</h2>
              <p className="mt-3 text-sm leading-6 text-ink/55">Tell us what you need and when you would like to create it.</p>
              <div className="mt-12"><BookingForm /></div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
