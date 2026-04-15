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

type OfficeOption = {
  id: string;
  name: string;
  hasCurrentSubmission: boolean;
  lastSubmittedAt: string | null;
  lastSubmittedBy: string | null;
};
type TruckOption = {
  id: string;
  name: string;
  licensePlate: string;
  officeId: string | null;
  lastOilChangeMiles: number | null;
  registrationExpirationMonth: number | null;
  registrationExpirationYear: number | null;
  hasCurrentSubmission: boolean;
};
type ItemOption = { id: string; name: string };

const STEP_LABELS = [
  "Office",
  "Truck",
  "Office Inventory",
  "Truck Inventory",
  "Details",
  "Review"
];

const COUNTING_RULE_TEXT =
  "Count unopened bottles, bags, and boxes only. Exception: Contrac Blox may include partial buckets.";

function mapCounts(items: ItemOption[]) {
  return items.map((item) => ({ itemId: item.id, quantity: 0 }));
}

function normalizeItemName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isContracBloxItem(name: string) {
  return normalizeItemName(name) === "contrac blox";
}

function getInventoryDisplayName(name: string) {
  const normalized = normalizeItemName(name);

  if (normalized === "bifen i/t") {
    return "Bifen I/T (Bags)";
  }
  if (normalized === "contrac blox") {
    return "Contrac Blox (Buckets)";
  }
  if (normalized === "demand cs") {
    return "Demand CS (Bottles)";
  }
  if (normalized === "niban") {
    return "Niban (Boxes)";
  }
  if (normalized === "pro flex") {
    return "Pro Flex (Bottles)";
  }
  if (normalized === "tandem") {
    return "Tandem (Bottles)";
  }
  if (normalized === "typhoons") {
    return "Typhoons (Backpack)";
  }

  return name;
}

function parsePartialBucketAmount(value: string | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function getPartialBucketSummary(
  partialBuckets: Record<string, string>,
  officeItems: ItemOption[],
  truckItems: ItemOption[],
  options?: { includeOffice?: boolean }
) {
  const segments: string[] = [];
  const includeOffice = options?.includeOffice ?? true;

  if (includeOffice) {
    for (const item of officeItems) {
      if (!isContracBloxItem(item.name)) {
        continue;
      }
      const amount = parsePartialBucketAmount(partialBuckets[`office:${item.id}`]);
      if (amount !== null) {
        segments.push(`Office/Shop ${getInventoryDisplayName(item.name)}: ${amount}`);
      }
    }
  }

  for (const item of truckItems) {
    if (!isContracBloxItem(item.name)) {
      continue;
    }
    const amount = parsePartialBucketAmount(partialBuckets[`truck:${item.id}`]);
    if (amount !== null) {
      segments.push(`Truck ${getInventoryDisplayName(item.name)}: ${amount}`);
    }
  }

  return segments.join("; ");
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
  const [partialBuckets, setPartialBuckets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [completedTruckIds, setCompletedTruckIds] = useState<Set<string>>(
    () => new Set(trucks.filter((truck) => truck.hasCurrentSubmission).map((truck) => truck.id))
  );
  const [isPending, startTransition] = useTransition();

  const form = useForm<TechnicianSubmissionInput>({
    resolver: zodResolver(technicianSubmissionSchema),
    defaultValues: {
      officeId: "",
      officeAction: "UPDATE",
      truckId: "",
      registrationExpirationMonth: undefined,
      registrationExpirationYear: undefined,
      odometerMiles: 0,
      lastOilChangeMiles: undefined,
      oilChangeCompleted: false,
      maintenanceCheckCompleted: false,
      lastOilChangeDate: "",
      maintenanceNotes: "",
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
      const parsed = JSON.parse(saved) as TechnicianSubmissionInput & {
        partialBuckets?: Record<string, string>;
      };
      form.reset({
        ...parsed,
        officeAction: parsed.officeAction ?? "UPDATE",
        registrationExpirationMonth: parsed.registrationExpirationMonth,
        registrationExpirationYear: parsed.registrationExpirationYear,
        odometerMiles: parsed.odometerMiles ?? 0,
        lastOilChangeMiles: parsed.lastOilChangeMiles,
        oilChangeCompleted: parsed.oilChangeCompleted ?? false,
        maintenanceCheckCompleted: parsed.maintenanceCheckCompleted ?? false,
        lastOilChangeDate: parsed.lastOilChangeDate ?? "",
        maintenanceNotes: parsed.maintenanceNotes ?? "",
        uploadedFileIds: parsed.uploadedFileIds ?? []
      });
      setPartialBuckets(parsed.partialBuckets ?? {});
    } catch {
      // ignore bad local draft data
    }
  }, [draftKey, form]);

  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          ...values,
          partialBuckets
        })
      );
    });

    return () => subscription.unsubscribe();
  }, [draftKey, form, partialBuckets]);

  const officeCounts = form.watch("officeCounts");
  const truckCounts = form.watch("truckCounts");
  const selectedOffice = useMemo(
    () => offices.find((office) => office.id === selectedOfficeId) ?? null,
    [offices, selectedOfficeId]
  );
  const officeAction = form.watch("officeAction");
  const canSkipOffice = Boolean(selectedOffice?.hasCurrentSubmission);
  const shouldSkipOffice = canSkipOffice && officeAction === "SKIP";
  const selectedTruckId = form.watch("truckId");
  const selectedTruck = useMemo(
    () => trucks.find((truck) => truck.id === selectedTruckId) ?? null,
    [selectedTruckId, trucks]
  );
  const officeTruckIds = useMemo(() => filteredTrucks.map((truck) => truck.id), [filteredTrucks]);
  const remainingTruckIds = useMemo(
    () => officeTruckIds.filter((truckId) => !completedTruckIds.has(truckId) && truckId !== selectedTruckId),
    [completedTruckIds, officeTruckIds, selectedTruckId]
  );
  const canSubmitAndContinue = step === STEP_LABELS.length && remainingTruckIds.length > 0;
  const needsRegistrationInfo = Boolean(
    selectedTruck &&
      (!selectedTruck.registrationExpirationMonth || !selectedTruck.registrationExpirationYear)
  );
  const partialBucketSummary = useMemo(
    () =>
      getPartialBucketSummary(partialBuckets, officeItems, truckItems, {
        includeOffice: !shouldSkipOffice
      }),
    [partialBuckets, officeItems, shouldSkipOffice, truckItems]
  );

  useEffect(() => {
    if (!selectedOffice) {
      return;
    }

    if (!selectedOffice.hasCurrentSubmission) {
      form.setValue("officeAction", "UPDATE");
    }
  }, [form, selectedOffice]);

  useEffect(() => {
    if (!selectedTruck) {
      return;
    }

    if (selectedTruck.registrationExpirationMonth && selectedTruck.registrationExpirationYear) {
      form.setValue("registrationExpirationMonth", selectedTruck.registrationExpirationMonth);
      form.setValue("registrationExpirationYear", selectedTruck.registrationExpirationYear);
    } else {
      form.setValue("registrationExpirationMonth", undefined);
      form.setValue("registrationExpirationYear", undefined);
    }

    form.setValue("lastOilChangeMiles", selectedTruck.lastOilChangeMiles ?? undefined);
  }, [form, selectedTruck]);

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
    setSuccessMessage(null);

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
      const valid = await form.trigger([
        "registrationExpirationMonth",
        "registrationExpirationYear",
        "odometerMiles",
        "lastOilChangeMiles",
        "technicianName",
        "notes",
        "problemsReported",
        "missingDamagedNotes"
      ]);
      if (!valid) {
        return;
      }
    }

    setStep((current) => Math.min(STEP_LABELS.length, current + 1));
  }

  function goBack() {
    setError(null);
    setSuccessMessage(null);
    setStep((current) => Math.max(1, current - 1));
  }

  function submitFinal(options?: { continueToNextTruck?: boolean }) {
    setError(null);
    setSuccessMessage(null);
    const values = form.getValues();
    const partialBucketNote = partialBucketSummary
      ? `Contrac Blox partial buckets (exception to unopened-only rule): ${partialBucketSummary}`
      : "";
    const mergedNotes = [values.notes?.trim(), partialBucketNote].filter(Boolean).join("\n\n");
    const continueToNextTruck = Boolean(options?.continueToNextTruck);

    startTransition(async () => {
      const response = await submitTechnicianInventoryAction({
        ...values,
        notes: mergedNotes,
        uploadedFileIds: uploadedFiles.map((file) => file.id)
      });

      if (!response.success || !response.submissionId) {
        setError(response.error ?? "Submission failed.");
        return;
      }

      const submittedTruckId = values.truckId;
      if (submittedTruckId) {
        setCompletedTruckIds((current) => {
          const next = new Set(current);
          next.add(submittedTruckId);
          return next;
        });
      }

      if (continueToNextTruck) {
        const nextTruckId = remainingTruckIds[0] ?? null;
        if (!nextTruckId) {
          localStorage.removeItem(draftKey);
          router.push(`/inventory/success?submission=${response.submissionId}`);
          return;
        }

        setUploadedFiles([]);
        setPartialBuckets({});
        form.setValue("officeAction", "SKIP");
        form.setValue("truckId", nextTruckId);
        form.setValue("truckCounts", mapCounts(truckItems));
        form.setValue("odometerMiles", 0);
        form.setValue("lastOilChangeMiles", nextTruckId ? (trucks.find((truck) => truck.id === nextTruckId)?.lastOilChangeMiles ?? undefined) : undefined);
        form.setValue("oilChangeCompleted", false);
        form.setValue("maintenanceCheckCompleted", false);
        form.setValue("lastOilChangeDate", "");
        form.setValue("maintenanceNotes", "");
        form.setValue("notes", "");
        form.setValue("problemsReported", "");
        form.setValue("missingDamagedNotes", "");
        form.setValue("uploadedFileIds", []);
        setStep(2);
        setSuccessMessage("Truck submitted. Continue with the next truck.");
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
          Complete office and truck counts for this month. Submit one truck, then continue to the next without restarting.
        </CardDescription>
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-semibold">Counting rule</p>
          <p className="mt-1">{COUNTING_RULE_TEXT}</p>
        </div>
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
                  {completedTruckIds.has(truck.id) ? " (already submitted this month)" : ""}
                </option>
              ))}
            </Select>
            <p className="text-sm text-red-600">{form.formState.errors.truckId?.message}</p>
            {selectedOfficeId ? (
              <p className="text-xs text-gray-600">
                Remaining trucks without a monthly submission: {remainingTruckIds.length}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardTitle>Office / Shop Inventory</CardTitle>
          <CardDescription className="mt-1">
            {canSkipOffice
              ? "An office submission already exists this month. Choose whether to keep it or update it."
              : `Enter counts for office/shop items. ${COUNTING_RULE_TEXT}`}
          </CardDescription>
          {canSkipOffice ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Last office submission:{" "}
                {selectedOffice?.lastSubmittedAt
                  ? `${new Date(selectedOffice.lastSubmittedAt).toLocaleString()} by ${
                      selectedOffice.lastSubmittedBy || "Unknown technician"
                    }`
                  : "Already submitted this month"}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Office inventory this submission</label>
                <Select {...form.register("officeAction")}>
                  <option value="UPDATE">Edit office inventory for this submission</option>
                  <option value="SKIP">Skip office inventory and keep existing monthly office counts</option>
                </Select>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              This office does not have a submission yet this month, so office inventory is required.
            </div>
          )}
          {!shouldSkipOffice ? (
            <div className="mt-4 grid gap-3">
              {officeItems.map((item, index) => (
                <div key={item.id}>
                  <CounterInput
                    label={getInventoryDisplayName(item.name)}
                    value={officeCounts[index]?.quantity ?? 0}
                    onChange={(quantity) => form.setValue(`officeCounts.${index}.quantity`, quantity)}
                  />
                  {isContracBloxItem(item.name) ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <label className="mb-1 block text-xs font-semibold text-amber-900">
                        Partial Buckets (Contrac Blox exception)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={0.25}
                        inputMode="decimal"
                        placeholder="Optional, e.g. 0.5"
                        value={partialBuckets[`office:${item.id}`] ?? ""}
                        onChange={(event) =>
                          setPartialBuckets((current) => ({
                            ...current,
                            [`office:${item.id}`]: event.target.value
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Office inventory will be skipped for this submission. Existing office counts for this month stay unchanged.
            </div>
          )}
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardTitle>Truck Inventory</CardTitle>
          <CardDescription className="mt-1">
            Enter counts for truck items. {COUNTING_RULE_TEXT}
          </CardDescription>
          <div className="mt-4 grid gap-3">
            {truckItems.map((item, index) => (
              <div key={item.id}>
                <CounterInput
                  label={getInventoryDisplayName(item.name)}
                  value={truckCounts[index]?.quantity ?? 0}
                  onChange={(quantity) => form.setValue(`truckCounts.${index}.quantity`, quantity)}
                />
                {isContracBloxItem(item.name) ? (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <label className="mb-1 block text-xs font-semibold text-amber-900">
                      Partial Buckets (Contrac Blox exception)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={0.25}
                      inputMode="decimal"
                      placeholder="Optional, e.g. 0.5"
                      value={partialBuckets[`truck:${item.id}`] ?? ""}
                      onChange={(event) =>
                        setPartialBuckets((current) => ({
                          ...current,
                          [`truck:${item.id}`]: event.target.value
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card>
          <CardTitle>Details & Mileage</CardTitle>
          <div className="mt-4 space-y-3">
            {needsRegistrationInfo ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                First-time setup: this truck needs registration expiration entered once.
              </div>
            ) : null}
            {needsRegistrationInfo ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Registration Expires Month</label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    step={1}
                    {...form.register("registrationExpirationMonth", { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Registration Expires Year</label>
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    step={1}
                    {...form.register("registrationExpirationYear", { valueAsNumber: true })}
                  />
                </div>
                <p className="sm:col-span-2 text-sm text-red-600">
                  {form.formState.errors.registrationExpirationMonth?.message ||
                    form.formState.errors.registrationExpirationYear?.message}
                </p>
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Truck Odometer (miles)</label>
              <Input
                type="number"
                min={0}
                step={1}
                {...form.register("odometerMiles", { valueAsNumber: true })}
              />
              <p className="text-sm text-red-600">{form.formState.errors.odometerMiles?.message}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Last Oil Change Miles</label>
              <Input
                type="number"
                min={0}
                step={1}
                {...form.register("lastOilChangeMiles", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value))
                })}
              />
              <p className="text-sm text-red-600">{form.formState.errors.lastOilChangeMiles?.message}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch("oilChangeCompleted")}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    form.setValue("oilChangeCompleted", checked);
                    if (checked) {
                      form.setValue("lastOilChangeMiles", form.getValues("odometerMiles"));
                    }
                  }}
                />
                Oil change completed
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch("maintenanceCheckCompleted")}
                  onChange={(event) => form.setValue("maintenanceCheckCompleted", event.target.checked)}
                />
                Maintenance check completed
              </label>
            </div>
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
              <strong>Truck Odometer:</strong> {form.getValues("odometerMiles")} miles
            </p>
            <p>
              <strong>Last Oil Change Miles:</strong> {form.getValues("lastOilChangeMiles") ?? "-"}
            </p>
            <p>
              <strong>Oil Change Completed:</strong> {form.getValues("oilChangeCompleted") ? "Yes" : "No"}
            </p>
            <p>
              <strong>Maintenance Check Completed:</strong>{" "}
              {form.getValues("maintenanceCheckCompleted") ? "Yes" : "No"}
            </p>
            <p>
              <strong>Registration Expires:</strong>{" "}
              {selectedTruck?.registrationExpirationMonth && selectedTruck?.registrationExpirationYear
                ? `${selectedTruck.registrationExpirationMonth}/${selectedTruck.registrationExpirationYear}`
                : form.getValues("registrationExpirationMonth") && form.getValues("registrationExpirationYear")
                  ? `${form.getValues("registrationExpirationMonth")}/${form.getValues("registrationExpirationYear")}`
                  : "-"}
            </p>
            <p>
              <strong>Office Item Total Units:</strong>{" "}
              {shouldSkipOffice
                ? "Skipped (existing office monthly counts kept)"
                : form.getValues("officeCounts").reduce((sum, item) => sum + item.quantity, 0)}
            </p>
            <p>
              <strong>Truck Item Total Units:</strong>{" "}
              {form.getValues("truckCounts").reduce((sum, item) => sum + item.quantity, 0)}
            </p>
            {partialBucketSummary ? (
              <p>
                <strong>Contrac Partial Buckets:</strong> {partialBucketSummary}
              </p>
            ) : null}
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
      {successMessage ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">{successMessage}</p>
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
            <>
              {canSubmitAndContinue ? (
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => submitFinal({ continueToNextTruck: true })}
                  disabled={isPending}
                >
                  {isPending ? "Submitting..." : "Submit & Next Truck"}
                </Button>
              ) : null}
              <Button className="flex-1" onClick={() => submitFinal()} disabled={isPending}>
                {isPending ? "Submitting..." : "Submit & Finish"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
