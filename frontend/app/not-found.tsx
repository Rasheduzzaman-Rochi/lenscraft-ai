import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="flex min-h-[80vh] items-center bg-bone pt-24">
      <div className="page-shell py-24 text-center">
        <p className="eyebrow">404 — Frame not found</p>
        <h1 className="mt-6 font-serif text-6xl leading-none sm:text-8xl">Outside the composition.</h1>
        <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-ink/55">The page you are looking for may have moved or is no longer part of this collection.</p>
        <div className="mt-9"><Button asChild><Link href="/">Return home</Link></Button></div>
      </div>
    </section>
  );
}
