import * as React from "react";

import { cn } from "@/lib/utils";

const controlClass =
  "min-h-12 w-full border-0 border-b border-ink/20 bg-transparent px-0 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-bronze focus:ring-0";

export function Field({ label, htmlFor, children, className }: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/55">
        {label}
      </label>
      {children}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(controlClass, className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlClass, "min-h-32 resize-y", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(controlClass, "cursor-pointer", className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";
