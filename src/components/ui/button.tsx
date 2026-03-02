import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-brand-default)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base-default)] disabled:cursor-not-allowed disabled:opacity-70",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--bg-brand-default)] text-[var(--text-brand-on-brand)] hover:brightness-95 hover:shadow-sm active:translate-y-px",
        outline:
          "border border-[var(--border-base-default)] bg-[var(--bg-base-default)] text-[var(--text-base-default)] hover:border-[var(--border-brand-default)] hover:bg-[var(--bg-brand-tertiary)]",
        secondary:
          "bg-[var(--bg-brand-tertiary)] text-[var(--text-brand-default)] hover:brightness-95",
        ghost:
          "bg-transparent text-[var(--text-base-default)] hover:bg-[var(--bg-base-tertiary)] hover:text-[var(--text-brand-default)]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
