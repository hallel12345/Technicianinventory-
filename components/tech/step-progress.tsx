import { cn } from "@/lib/utils";

export function StepProgress({
  current,
  total,
  labels
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(100, (current / total) * 100))}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {labels.map((label, index) => {
          const stepNumber = index + 1;
          const active = stepNumber === current;
          const complete = stepNumber < current;
          return (
            <span
              key={label}
              className={cn(
                "rounded-full px-2 py-1",
                active && "bg-brand-light text-brand-dark",
                complete && "bg-green-100 text-green-700",
                !active && !complete && "bg-gray-100 text-gray-500"
              )}
            >
              {stepNumber}. {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
