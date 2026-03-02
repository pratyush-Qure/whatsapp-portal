import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm text-[var(--text-base-default)] placeholder:text-[var(--text-disabled-default)] transition-colors duration-150 hover:border-[var(--border-base-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-brand-default)] disabled:cursor-not-allowed disabled:bg-[var(--bg-base-tertiary)] disabled:text-[var(--text-disabled-default)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
