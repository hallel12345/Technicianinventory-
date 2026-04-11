import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-primary text-brand-dark hover:bg-[#8ABD66] focus-visible:ring-2 focus-visible:ring-brand-primary",
  secondary:
    "bg-brand-light text-brand-dark hover:bg-[#BFEBC2] focus-visible:ring-2 focus-visible:ring-brand-primary",
  ghost: "bg-transparent text-brand-dark hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand-primary",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-400"
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
