import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "bg-[var(--bg-brand-tertiary)] text-[var(--text-brand-default)]",
        success: "bg-[var(--bg-success-tertiary)] text-[var(--text-success-default)]",
        warning: "bg-[var(--bg-warning-tertiary)] text-[var(--text-warning-default)]",
        danger: "bg-[var(--bg-danger-tertiary)] text-[var(--text-danger-default)]",
        neutral: "bg-[var(--bg-base-tertiary)] text-[var(--text-base-secondary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
