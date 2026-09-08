import type { Metadata } from "next";
import { CalendarCheck, CheckCircle2, Clock3, ContactRound, Images } from "lucide-react";

import { BookingForm } from "@/components/booking-form";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/reveal";
import { StudioImage } from "@/components/studio-image";
import { images } from "@/lib/images";

export const metadata: Metadata = {
  title: "Request a Booking",
  description: "Request a photography booking with LensCraft Studio.",
};

const notes = [
  { icon: Images, title: "Choose a service", text: "Select the production discipline that best fits your brief." },
  { icon: Clock3, title: "Select your time", text: "Choose a preferred date and Dhaka studio time." },
  { icon: CalendarCheck, title: "Check availability", text: "We check the exact appointment against confirmed work." },
  { icon: ContactRound, title: "Share your details", text: "Add the customer and project information our team needs." },
  { icon: CheckCircle2, title: "Submit for review", text: "The studio confirms every booking request personally." },
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
        <div className="page-shell grid gap-14 lg:grid-cols-[0.48fr_1.52fr] lg:gap-20">
          <Reveal>
            <aside className="lg:sticky lg:top-36">
              <p className="eyebrow">Your booking journey</p>
              <div className="mt-7 space-y-6">
                {notes.map(({ icon: Icon, title, text }, index) => (
                  <div key={title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15">
                      <Icon className="h-4 w-4 text-bronze" strokeWidth={1.4} />
                    </div>
                    <div>
                      <p className="font-serif text-xl">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-ink/50">{text}</p>
                      <p className="mt-1 text-[8px] uppercase tracking-[0.2em] text-ink/30">Step 0{index + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
              <StudioImage
                src={images.booking.consultation}
                title="LensCraft studio consultation"
                orientation="landscape"
                minimal
                className="mt-9 hidden lg:block"
                sizes="28vw"
              />
            </aside>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="border border-ink/15 bg-bone p-5 shadow-[0_25px_80px_rgba(23,22,18,0.06)] sm:p-8 lg:p-11">
              <div className="flex items-end justify-between gap-6"><div><p className="eyebrow">Private studio request</p><h2 className="mt-3 font-serif text-3xl sm:text-4xl">Shape your session.</h2></div><span className="hidden text-[8px] uppercase tracking-[0.18em] text-ink/30 sm:block">Usually 3 minutes</span></div>
              <div className="mt-9"><BookingForm /></div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
