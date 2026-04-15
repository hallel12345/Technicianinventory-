"use client";

import { useMemo, useState, useTransition } from "react";

import { editSubmissionAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CounterInput } from "@/components/tech/counter-input";

type EditableCount = {
  itemId: string;
  itemName: string;
  quantity: number;
};

export function SubmissionEditForm({
  submissionType,
  submissionId,
  technicianName,
  odometerMiles,
  lastOilChangeMiles,
  oilChangeCompleted,
  maintenanceCheckCompleted,
  lastOilChangeDate,
  maintenanceNotes,
  notes,
  problemsReported,
  missingDamagedNotes,
  counts
}: {
  submissionType: "office" | "truck";
  submissionId: string;
  technicianName: string;
  odometerMiles?: number;
  lastOilChangeMiles?: number;
  oilChangeCompleted?: boolean;
  maintenanceCheckCompleted?: boolean;
  lastOilChangeDate?: string;
  maintenanceNotes?: string;
  notes: string;
  problemsReported: string;
  missingDamagedNotes: string;
  counts: EditableCount[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(technicianName);
  const [mileageValue, setMileageValue] = useState<number>(odometerMiles ?? 0);
  const [lastOilChangeMilesValue, setLastOilChangeMilesValue] = useState<number | "">(
    lastOilChangeMiles ?? ""
  );
  const [oilChangedValue, setOilChangedValue] = useState<boolean>(oilChangeCompleted ?? false);
  const [maintenanceCheckValue, setMaintenanceCheckValue] = useState<boolean>(maintenanceCheckCompleted ?? false);
  const [lastOilChangeDateValue, setLastOilChangeDateValue] = useState<string>(lastOilChangeDate ?? "");
  const [maintenanceNotesValue, setMaintenanceNotesValue] = useState<string>(maintenanceNotes ?? "");
  const [notesValue, setNotesValue] = useState(notes);
  const [problemsValue, setProblemsValue] = useState(problemsReported);
  const [missingValue, setMissingValue] = useState(missingDamagedNotes);
  const [countsState, setCountsState] = useState<EditableCount[]>(counts);

  const totals = useMemo(
    () => countsState.reduce((sum, count) => sum + count.quantity, 0),
    [countsState]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Technician Name</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Total Units</label>
          <Input value={String(totals)} readOnly />
        </div>
      </div>

      {submissionType === "truck" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Truck Odometer (miles)</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={String(mileageValue)}
              onChange={(event) => setMileageValue(Math.max(0, Number(event.target.value || 0)))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Last Oil Change Miles</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={String(lastOilChangeMilesValue)}
              onChange={(event) =>
                setLastOilChangeMilesValue(
                  event.target.value === "" ? "" : Math.max(0, Number(event.target.value || 0))
                )
              }
            />
          </div>
          <div className="grid gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={oilChangedValue}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setOilChangedValue(checked);
                  if (checked) {
                    setLastOilChangeMilesValue(mileageValue);
                  }
                }}
              />
              Oil change completed
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={maintenanceCheckValue}
                onChange={(event) => setMaintenanceCheckValue(event.target.checked)}
              />
              Maintenance check completed
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Last Oil Change Date</label>
            <Input
              type="date"
              value={lastOilChangeDateValue}
              onChange={(event) => setLastOilChangeDateValue(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Maintenance Notes</label>
            <Textarea value={maintenanceNotesValue} onChange={(event) => setMaintenanceNotesValue(event.target.value)} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
          <Textarea value={notesValue} onChange={(event) => setNotesValue(event.target.value)} />
        </div>
        <div className="sm:col-span-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Problems Reported</label>
          <Textarea value={problemsValue} onChange={(event) => setProblemsValue(event.target.value)} />
        </div>
        <div className="sm:col-span-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Missing / Damaged</label>
          <Textarea value={missingValue} onChange={(event) => setMissingValue(event.target.value)} />
        </div>
      </div>

      <div className="grid gap-3">
        {countsState.map((count, index) => (
          <CounterInput
            key={count.itemId}
            label={count.itemName}
            value={count.quantity}
            onChange={(quantity) => {
              setCountsState((current) =>
                current.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, quantity } : entry
                )
              );
            }}
          />
        ))}
      </div>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Button
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            try {
              const result = await editSubmissionAction({
                submissionType,
                submissionId,
                technicianName: name,
                odometerMiles: submissionType === "truck" ? mileageValue : undefined,
                lastOilChangeMiles:
                  submissionType === "truck" && lastOilChangeMilesValue !== ""
                    ? Number(lastOilChangeMilesValue)
                    : undefined,
                oilChangeCompleted: submissionType === "truck" ? oilChangedValue : undefined,
                maintenanceCheckCompleted: submissionType === "truck" ? maintenanceCheckValue : undefined,
                lastOilChangeDate: submissionType === "truck" ? lastOilChangeDateValue : undefined,
                maintenanceNotes: submissionType === "truck" ? maintenanceNotesValue : undefined,
                notes: notesValue,
                problemsReported: problemsValue,
                missingDamagedNotes: missingValue,
                counts: countsState.map((count) => ({ itemId: count.itemId, quantity: count.quantity }))
              });

              if (!result.success) {
                setError(result.error ?? "Failed to save changes.");
                return;
              }

              setMessage("Submission updated.");
            } catch (error) {
              setError(error instanceof Error ? error.message : "Failed to save changes.");
            }
          });
        }}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
