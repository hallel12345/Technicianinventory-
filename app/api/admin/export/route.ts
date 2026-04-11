import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { getRegistrationStatus } from "@/lib/services/registration";
import { getTruckMileageMetricsMap } from "@/lib/services/truck-metrics";
import { getCurrentMonthYear } from "@/lib/time";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const now = getCurrentMonthYear();

  const month = Number(url.searchParams.get("month") ?? now.month);
  const year = Number(url.searchParams.get("year") ?? now.year);
  const type = (url.searchParams.get("type") ?? "all") as "all" | "office" | "truck";

  const officeId = url.searchParams.get("officeId") || undefined;
  const truckId = url.searchParams.get("truckId") || undefined;

  const [officeSubmissions, truckSubmissions] = await Promise.all([
    type === "truck"
      ? Promise.resolve([])
      : db.officeInventorySubmission.findMany({
          where: { month, year, officeId },
          include: {
            office: true,
            counts: {
              include: { inventoryItem: true }
            }
          }
        }),
    type === "office"
      ? Promise.resolve([])
      : db.truckInventorySubmission.findMany({
          where: { month, year, truckId },
          include: {
            truck: true,
            counts: {
              include: { inventoryItem: true }
            }
          }
        })
  ]);

  const rows: Array<Record<string, string | number | null | undefined>> = [];
  const truckMileageMap = await getTruckMileageMetricsMap(
    db,
    truckSubmissions.map((submission) => ({
      id: submission.id,
      truckId: submission.truckId,
      month: submission.month,
      year: submission.year,
      odometerMiles: submission.odometerMiles
    }))
  );

  for (const submission of officeSubmissions) {
    for (const count of submission.counts) {
      rows.push({
        type: "office",
        month: submission.month,
        year: submission.year,
        targetName: submission.office.name,
        technicianName: submission.technicianName,
        submittedAt: submission.submittedAt.toISOString(),
        itemName: count.inventoryItem.name,
        quantity: count.quantity,
        registrationExpirationMonth: null,
        registrationExpirationYear: null,
        registrationStatus: null,
        odometerMiles: null,
        previousOdometerMiles: null,
        milesDrivenSinceLast: null,
        milesIntoOilCycle: null,
        oilChangeProgressPercent: null,
        milesUntilOilChange: null,
        oilChangeCompleted: null,
        maintenanceCheckCompleted: null,
        lastOilChangeDate: null,
        oilChangeDue: null,
        maintenanceNotes: null,
        notes: submission.notes,
        problemsReported: submission.problemsReported,
        missingDamagedNotes: submission.missingDamagedNotes
      });
    }
  }

  for (const submission of truckSubmissions) {
    const mileageMetrics = truckMileageMap.get(submission.id);
    for (const count of submission.counts) {
      rows.push({
        type: "truck",
        month: submission.month,
        year: submission.year,
        targetName: `${submission.truck.name} (${submission.truck.licensePlate})`,
        technicianName: submission.technicianName,
        submittedAt: submission.submittedAt.toISOString(),
        itemName: count.inventoryItem.name,
        quantity: count.quantity,
        registrationExpirationMonth: submission.truck.registrationExpirationMonth ?? null,
        registrationExpirationYear: submission.truck.registrationExpirationYear ?? null,
        registrationStatus: getRegistrationStatus({
          expirationMonth: submission.truck.registrationExpirationMonth,
          expirationYear: submission.truck.registrationExpirationYear,
          month,
          year
        }),
        odometerMiles: submission.odometerMiles,
        previousOdometerMiles: mileageMetrics?.previousOdometerMiles ?? null,
        milesDrivenSinceLast: mileageMetrics?.milesDrivenSinceLast ?? null,
        milesIntoOilCycle: mileageMetrics?.milesIntoOilCycle ?? null,
        oilChangeProgressPercent: mileageMetrics?.oilChangeProgressPercent ?? null,
        milesUntilOilChange: mileageMetrics?.milesUntilOilChange ?? null,
        oilChangeCompleted: submission.oilChangeCompleted ? "yes" : "no",
        maintenanceCheckCompleted: submission.maintenanceCheckCompleted ? "yes" : "no",
        lastOilChangeDate: submission.lastOilChangeDate ? submission.lastOilChangeDate.toISOString().slice(0, 10) : null,
        oilChangeDue: mileageMetrics?.oilChangeDue ? "yes" : "no",
        maintenanceNotes: submission.maintenanceNotes,
        notes: submission.notes,
        problemsReported: submission.problemsReported,
        missingDamagedNotes: submission.missingDamagedNotes
      });
    }
  }

  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${year}-${String(month).padStart(2, "0")}-${type}.csv"`
    }
  });
}
