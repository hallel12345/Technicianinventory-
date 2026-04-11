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
  notes,
  problemsReported,
  missingDamagedNotes,
  counts
}: {
  submissionType: "office" | "truck";
  submissionId: string;
  technicianName: string;
  notes: string;
  problemsReported: string;
  missingDamagedNotes: string;
  counts: EditableCount[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(technicianName);
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
            const result = await editSubmissionAction({
              submissionType,
              submissionId,
              technicianName: name,
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
          });
        }}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
