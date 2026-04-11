"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { submitTechnicianInventoryAction } from "@/lib/actions/technician";
import { type TechnicianSubmissionInput, technicianSubmissionSchema } from "@/lib/schemas/submission";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CounterInput } from "@/components/tech/counter-input";
import { StepProgress } from "@/components/tech/step-progress";

type OfficeOption = { id: string; name: string };
type TruckOption = { id: string; name: string; licensePlate: string; officeId: string | null };
type ItemOption = { id: string; name: string };

const STEP_LABELS = [
  "Office",
  "Truck",
  "Office Inventory",
  "Truck Inventory",
  "Details",
  "Review"
];

function mapCounts(items: ItemOption[]) {
  return items.map((item) => ({ itemId: item.id, quantity: 0 }));
}

export function InventoryWizard({
  offices,
  trucks,
  officeItems,
  truckItems,
  technicianName,
  draftKey
}: {
  offices: OfficeOption[];
  trucks: TruckOption[];
  officeItems: ItemOption[];
  truckItems: ItemOption[];
  technicianName: string;
  draftKey: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<TechnicianSubmissionInput>({
    resolver: zodResolver(technicianSubmissionSchema),
    defaultValues: {
      officeId: "",
      truckId: "",
      technicianName,
      notes: "",
      problemsReported: "",
      missingDamagedNotes: "",
      officeCounts: mapCounts(officeItems),
      truckCounts: mapCounts(truckItems),
      uploadedFileIds: []
    }
  });

  const selectedOfficeId = form.watch("officeId");
  const filteredTrucks = useMemo(() => {
    if (!selectedOfficeId) {
      return trucks;
    }
    const officeTrucks = trucks.filter((truck) => truck.officeId === selectedOfficeId);
    return officeTrucks.length ? officeTrucks : trucks;
  }, [selectedOfficeId, trucks]);

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as TechnicianSubmissionInput;
      form.reset({
        ...parsed,
        uploadedFileIds: parsed.uploadedFileIds ?? []
      });
    } catch {
      // ignore bad local draft data
    }
  }, [draftKey, form]);

  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem(draftKey, JSON.stringify(values));
    });

    return () => subscription.unsubscribe();
  }, [draftKey, form]);

  const officeCounts = form.watch("officeCounts");
  const truckCounts = form.watch("truckCounts");

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const uploaded: Array<{ id: string; name: string }> = [];

    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body
      });

      if (!response.ok) {
        const responseJson = (await response.json()) as { error?: string };
        throw new Error(responseJson.error ?? "Failed to upload file.");
      }

      const json = (await response.json()) as { id: string };
      uploaded.push({ id: json.id, name: file.name });
    }

    setUploadedFiles((current) => {
      const next = [...current, ...uploaded];
      form.setValue(
        "uploadedFileIds",
        next.map((file) => file.id)
      );
      return next;
    });
  }

  async function goNext() {
    setError(null);

    if (step === 1) {
      const valid = await form.trigger("officeId");
      if (!valid) {
        return;
      }
    }

    if (step === 2) {
      const valid = await form.trigger("truckId");
      if (!valid) {
        return;
      }
    }

    if (step === 5) {
      const valid = await form.trigger(["technicianName", "notes", "problemsReported", "missingDamagedNotes"]);
      if (!valid) {
        return;
      }
    }

    setStep((current) => Math.min(STEP_LABELS.length, current + 1));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(1, current - 1));
  }

  function submitFinal() {
    setError(null);
    const values = form.getValues();

    startTransition(async () => {
      const response = await submitTechnicianInventoryAction({
        ...values,
        uploadedFileIds: uploadedFiles.map((file) => file.id)
      });

      if (!response.success || !response.submissionId) {
        setError(response.error ?? "Submission failed.");
        return;
      }

      localStorage.removeItem(draftKey);
      router.push(`/inventory/success?submission=${response.submissionId}`);
    });
  }

  return (
    <div className="space-y-4 pb-28">
      <Card>
        <CardTitle>Monthly Inventory Wizard</CardTitle>
        <CardDescription className="mt-1">
          Complete office and truck counts for this month. Progress is auto-saved on this device.
        </CardDescription>
        <div className="mt-4">
          <StepProgress current={step} total={STEP_LABELS.length} labels={STEP_LABELS} />
        </div>
      </Card>

      {step === 1 ? (
        <Card>
          <CardTitle>Select Office</CardTitle>
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium text-gray-700">Office</label>
            <Select {...form.register("officeId")}> 
              <option value="">Choose an office</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </Select>
            <p className="text-sm text-red-600">{form.formState.errors.officeId?.message}</p>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardTitle>Select Truck</CardTitle>
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium text-gray-700">Truck / License Plate</label>
            <Select {...form.register("truckId")}> 
              <option value="">Choose a truck</option>
              {filteredTrucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.name} - {truck.licensePlate}
                </option>
              ))}
            </Select>
            <p className="text-sm text-red-600">{form.formState.errors.truckId?.message}</p>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardTitle>Office / Shop Inventory</CardTitle>
          <CardDescription className="mt-1">Enter counts for office/shop items.</CardDescription>
          <div className="mt-4 grid gap-3">
            {officeItems.map((item, index) => (
              <CounterInput
                key={item.id}
                label={item.name}
                value={officeCounts[index]?.quantity ?? 0}
                onChange={(quantity) => form.setValue(`officeCounts.${index}.quantity`, quantity)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardTitle>Truck Inventory</CardTitle>
          <CardDescription className="mt-1">Enter counts for truck items.</CardDescription>
          <div className="mt-4 grid gap-3">
            {truckItems.map((item, index) => (
              <CounterInput
                key={item.id}
                label={item.name}
                value={truckCounts[index]?.quantity ?? 0}
                onChange={(quantity) => form.setValue(`truckCounts.${index}.quantity`, quantity)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card>
          <CardTitle>Details & Notes</CardTitle>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Technician Name</label>
              <Input {...form.register("technicianName")} />
              <p className="text-sm text-red-600">{form.formState.errors.technicianName?.message}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <Textarea {...form.register("notes")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Problems to Report</label>
              <Textarea {...form.register("problemsReported")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Missing or Damaged Equipment</label>
              <Textarea {...form.register("missingDamagedNotes")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Optional Photos</label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={async (event) => {
                  try {
                    setError(null);
                    await uploadFiles(event.target.files);
                    event.target.value = "";
                  } catch (uploadError) {
                    setError(uploadError instanceof Error ? uploadError.message : "File upload failed.");
                  }
                }}
              />
              {uploadedFiles.length ? (
                <p className="mt-1 text-xs text-gray-600">{uploadedFiles.length} photo(s) uploaded.</p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {step === 6 ? (
        <Card>
          <CardTitle>Review Before Submit</CardTitle>
          <CardDescription className="mt-1">Please confirm details before final submission.</CardDescription>
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <p>
              <strong>Office:</strong> {offices.find((office) => office.id === form.getValues("officeId"))?.name || "-"}
            </p>
            <p>
              <strong>Truck:</strong>{" "}
              {filteredTrucks.find((truck) => truck.id === form.getValues("truckId"))?.licensePlate || "-"}
            </p>
            <p>
              <strong>Technician:</strong> {form.getValues("technicianName")}
            </p>
            <p>
              <strong>Office Item Total Units:</strong>{" "}
              {form.getValues("officeCounts").reduce((sum, item) => sum + item.quantity, 0)}
            </p>
            <p>
              <strong>Truck Item Total Units:</strong>{" "}
              {form.getValues("truckCounts").reduce((sum, item) => sum + item.quantity, 0)}
            </p>
            <p>
              <strong>Uploaded Photos:</strong> {uploadedFiles.length}
            </p>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl gap-3">
          <Button variant="ghost" className="flex-1" onClick={goBack} disabled={step === 1 || isPending}>
            Back
          </Button>
          {step < STEP_LABELS.length ? (
            <Button className="flex-1" onClick={goNext} disabled={isPending}>
              Continue
            </Button>
          ) : (
            <Button className="flex-1" onClick={submitFinal} disabled={isPending}>
              {isPending ? "Submitting..." : "Submit Inventory"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
