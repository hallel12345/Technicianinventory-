import { format } from "date-fns";

import { formatMonthYear } from "@/lib/time";
import type { MonthlySnapshotEntity } from "@/lib/services/monthly";

function renderEntity(entity: MonthlySnapshotEntity) {
  const statusLabel = entity.required ? (entity.submitted ? "Complete" : "Missing") : "Not required";
  const submissionMeta = entity.submitted
    ? `${entity.technicianName ?? "Unknown"} at ${entity.submittedAt ? format(entity.submittedAt, "MMM d, yyyy h:mm a") : "Unknown"}`
    : "Not submitted";

  const notesBlock =
    entity.submitted && (entity.notes || entity.problemsReported || entity.missingDamagedNotes)
      ? `<div style="margin-top:8px;font-size:13px;line-height:1.5;color:#333;">
          ${entity.notes ? `<div><strong>Notes:</strong> ${entity.notes}</div>` : ""}
          ${entity.problemsReported ? `<div><strong>Problems:</strong> ${entity.problemsReported}</div>` : ""}
          ${entity.missingDamagedNotes ? `<div><strong>Missing/Damaged:</strong> ${entity.missingDamagedNotes}</div>` : ""}
        </div>`
      : "";

  const counts = entity.counts?.length
    ? `<div style="margin-top:8px;font-size:12px;color:#444;">${entity.counts
        .map((count) => `${count.item}: ${count.quantity}`)
        .join(" | ")}</div>`
    : "";

  return `<div style="padding:12px;border:1px solid #E5E7EB;border-radius:10px;margin-bottom:10px;background:#fff;">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
      <strong style="color:#111827;">${entity.name}</strong>
      <span style="font-size:12px;padding:3px 8px;border-radius:999px;background:${
        statusLabel === "Complete" ? "#D3FDD7" : statusLabel === "Missing" ? "#FEE2E2" : "#E5E7EB"
      };color:#111827;">${statusLabel}</span>
    </div>
    <div style="margin-top:6px;font-size:13px;color:#374151;">${submissionMeta}</div>
    ${notesBlock}
    ${counts}
  </div>`;
}

export function buildMonthlySummaryEmail(input: {
  month: number;
  year: number;
  percentComplete: number;
  offices: MonthlySnapshotEntity[];
  trucks: MonthlySnapshotEntity[];
  requiredOfficeCount: number;
  requiredTruckCount: number;
  completedOfficeCount: number;
  completedTruckCount: number;
  isFinal: boolean;
}) {
  const monthLabel = formatMonthYear(input.month, input.year);

  const html = `
  <div style="font-family:Montserrat,Arial,sans-serif;background:#F6FAF2;padding:24px;">
    <div style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #E5E7EB;">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="https://pure-pest.com/wp-content/uploads/2023/03/1677641792910000950-e1677821353214.jpg" alt="Pure Pest Solutions" style="height:48px;width:auto;" />
        <div>
          <h1 style="margin:0;color:#434343;font-size:24px;">${input.isFinal ? "Final Monthly Completion" : "Monthly Inventory Summary"}</h1>
          <p style="margin:4px 0 0;color:#4B5563;">${monthLabel}</p>
        </div>
      </div>

      <div style="margin-top:18px;padding:14px;border-radius:12px;background:#D3FDD7;">
        <strong style="color:#1F2937;">Completion: ${input.percentComplete}%</strong>
        <div style="margin-top:8px;font-size:14px;color:#374151;">
          Offices: ${input.completedOfficeCount}/${input.requiredOfficeCount} | Trucks: ${input.completedTruckCount}/${input.requiredTruckCount}
        </div>
      </div>

      <h2 style="margin-top:24px;color:#434343;">Office / Shop Inventory</h2>
      ${input.offices.map(renderEntity).join("")}

      <h2 style="margin-top:24px;color:#434343;">Truck Inventory</h2>
      ${input.trucks.map(renderEntity).join("")}

      <p style="margin-top:28px;font-size:12px;color:#6B7280;">This email was generated automatically by the Pure Pest Inventory system.</p>
    </div>
  </div>`;

  const text = [
    `${input.isFinal ? "FINAL MONTHLY COMPLETION" : "MONTHLY INVENTORY SUMMARY"}`,
    `Month: ${monthLabel}`,
    `Completion: ${input.percentComplete}%`,
    `Offices: ${input.completedOfficeCount}/${input.requiredOfficeCount}`,
    `Trucks: ${input.completedTruckCount}/${input.requiredTruckCount}`,
    "",
    "Office / Shop Inventory:",
    ...input.offices.map((office) => {
      const summary = `${office.name} - ${office.required ? (office.submitted ? "Complete" : "Missing") : "Not required"}`;
      const notes = [office.notes, office.problemsReported, office.missingDamagedNotes].filter(Boolean).join(" | ");
      return notes ? `${summary} (${notes})` : summary;
    }),
    "",
    "Truck Inventory:",
    ...input.trucks.map((truck) => {
      const summary = `${truck.name} - ${truck.required ? (truck.submitted ? "Complete" : "Missing") : "Not required"}`;
      const notes = [truck.notes, truck.problemsReported, truck.missingDamagedNotes].filter(Boolean).join(" | ");
      return notes ? `${summary} (${notes})` : summary;
    })
  ].join("\n");

  return { html, text, monthLabel };
}
