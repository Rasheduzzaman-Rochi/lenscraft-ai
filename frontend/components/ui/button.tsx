import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border text-[11px] font-semibold uppercase tracking-[0.2em] transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-ink bg-ink px-6 py-4 text-paper hover:bg-bronze hover:border-bronze",
        light: "border-paper bg-paper px-6 py-4 text-ink hover:bg-transparent hover:text-paper",
        outline: "border-ink/25 bg-transparent px-6 py-4 text-ink hover:border-ink hover:bg-ink hover:text-paper",
        ghost: "border-transparent px-2 py-2 text-ink hover:text-bronze",
      },
      size: {
        default: "min-h-12",
        small: "min-h-10 px-4 py-3",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
