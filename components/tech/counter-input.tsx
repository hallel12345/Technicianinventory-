"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CounterInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export function CounterInput({ label, value, onChange }: CounterInputProps) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <label className="mb-3 block text-sm font-semibold text-gray-800">{label}</label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-11 rounded-full p-0"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(0, safeValue - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          step={1}
          value={safeValue}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value || "0", 10);
            onChange(Number.isFinite(next) ? Math.max(0, next) : 0);
          }}
          className="h-11 text-center text-lg font-semibold"
          aria-label={label}
        />
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-11 rounded-full p-0"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(safeValue + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
