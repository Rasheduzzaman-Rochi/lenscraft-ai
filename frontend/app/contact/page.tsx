import type { Metadata } from "next";
import { Clock3, Mail, MapPin } from "lucide-react";

import { ContactForm } from "@/components/contact-form";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Contact",
  description: "Discuss an upcoming photography project with LensCraft Studio.",
};

const details = [
  { icon: Mail, label: "Email", value: "hello@lenscraft.studio" },
  { icon: Clock3, label: "Studio hours", value: "Sunday–Thursday, 9:00–18:00" },
  { icon: MapPin, label: "Based in", value: "Dhaka — available worldwide" },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact — 03"
        title="Let’s make something distinct."
        intro="Share the shape of your project. We will come back with the right questions, a clear next step, and no unnecessary complexity."
      />
      <section className="section-space bg-paper">
        <div className="page-shell grid gap-16 lg:grid-cols-[0.65fr_1.35fr] lg:gap-24">
          <Reveal>
            <div className="lg:sticky lg:top-36">
              <p className="eyebrow">Studio details</p>
              <div className="mt-7 divide-y divide-ink/15 border-y border-ink/15">
                {details.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex gap-4 py-6">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-bronze" strokeWidth={1.4} />
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40">{label}</p>
                      <p className="mt-2 text-sm leading-6 text-ink/75">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs leading-5 text-ink/45">For active productions, your producer will provide direct contact details.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="border border-ink/15 bg-bone p-6 sm:p-10 lg:p-14">
              <p className="font-serif text-3xl sm:text-4xl">Project enquiry</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink/55">A few useful details are enough to begin.</p>
              <div className="mt-10"><ContactForm /></div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
