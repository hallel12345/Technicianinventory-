import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm",
          "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
