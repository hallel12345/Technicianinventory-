import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  children,
  variant = "default"
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const styles = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-700"
  } as const;

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", styles[variant])}>
      {children}
    </span>
  );
}
