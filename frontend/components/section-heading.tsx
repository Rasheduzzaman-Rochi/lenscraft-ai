import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, intro, align = "left", light = false }: {
  eyebrow: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
  light?: boolean;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      <p className={cn("eyebrow", light && "text-paper/55")}>{eyebrow}</p>
      <h2 className={cn("mt-5 font-serif text-4xl leading-[0.98] sm:text-5xl lg:text-6xl", light ? "text-paper" : "text-ink")}>
        {title}
      </h2>
      {intro ? (
        <p className={cn("mt-6 max-w-2xl text-base leading-7", align === "center" && "mx-auto", light ? "text-paper/65" : "text-ink/60")}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}
