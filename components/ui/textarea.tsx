import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[96px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm",
        "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary",
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
