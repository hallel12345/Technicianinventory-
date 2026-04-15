import { Prisma, RequirementTargetType } from "@prisma/client";

import { db } from "@/lib/db";
import { getRegistrationStatus, type RegistrationStatus } from "@/lib/services/registration";
import { getTruckMileageMetricsMap } from "@/lib/services/truck-metrics";
import { monthKey } from "@/lib/time";

export type MonthlyTx = Prisma.TransactionClient;
type MonthlyReadClient = Pick<Prisma.TransactionClient, "office" | "truck" | "monthlyRequirementOverride">;

type RequiredEntityStatus = {
  id: string;
  name: string;
  required: boolean;
};

type RequiredTruckStatus = RequiredEntityStatus & {
  lastOilChangeMiles: number | null;
  registrationExpirationMonth: number | null;
  registrationExpirationYear: number | null;
};

export type MonthlySnapshotEntity = RequiredEntityStatus & {
  submitted: boolean;
  submissionId?: string;
  technicianName?: string;
  submittedAt?: Date;
  registrationExpirationMonth?: number | null;
  registrationExpirationYear?: number | null;
  lastOilChangeMiles?: number | null;
  registrationStatus?: RegistrationStatus;
  odometerMiles?: number;
  trackingStartOdometerMiles?: number | null;
  previousOdometerMiles?: number | null;
  milesDrivenSinceLast?: number | null;
  milesIntoOilCycle?: number | null;
  milesUntilOilChange?: number | null;
  oilChangeProgressPercent?: number | null;
  oilChangeProgressState?: "green" | "yellow" | "red";
  oilChangeCompleted?: boolean;
  maintenanceCheckCompleted?: boolean;
  lastOilChangeDate?: Date | null;
  maintenanceNotes?: string | null;
  oilChangeDue?: boolean;
  notes?: string | null;
  problemsReported?: string | null;
  missingDamagedNotes?: string | null;
  counts?: Array<{ item: string; quantity: number }>;
};

export async function ensureMonthlyCycle(tx: MonthlyTx, month: number, year: number) {
  return tx.monthlyCycle.upsert({
    where: { month_year: { month, year } },
    update: {},
    create: { month, year }
  });
}

export async function getRequiredTargetsForMonth(tx: MonthlyReadClient, month: number, year: number) {
  const [offices, trucks, overrides] = await Promise.all([
    tx.office.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, requiredByDefault: true }
    }),
    tx.truck.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { licensePlate: "asc" }],
      select: {
        id: true,
        name: true,
        licensePlate: true,
        requiredByDefault: true,
        lastOilChangeMiles: true,
        registrationExpirationMonth: true,
        registrationExpirationYear: true,
        office: { select: { name: true } }
      }
    }),
    tx.monthlyRequirementOverride.findMany({
      where: { month, year }
    })
  ]);

  const officeOverrideMap = new Map(
    overrides
      .filter((override) => override.targetType === RequirementTargetType.OFFICE && override.officeId)
      .map((override) => [override.officeId as string, override.isRequired])
  );

  const truckOverrideMap = new Map(
    overrides
      .filter((override) => override.targetType === RequirementTargetType.TRUCK && override.truckId)
      .map((override) => [override.truckId as string, override.isRequired])
  );

  const officeTargets: RequiredEntityStatus[] = offices.map((office) => ({
    id: office.id,
    name: office.name,
    required: officeOverrideMap.get(office.id) ?? office.requiredByDefault
  }));

  const truckTargets: RequiredTruckStatus[] = trucks.map((truck) => ({
    id: truck.id,
    name: `${truck.name} - ${truck.licensePlate}${truck.office?.name ? ` (${truck.office.name})` : ""}`,
    required: truckOverrideMap.get(truck.id) ?? truck.requiredByDefault,
    lastOilChangeMiles: truck.lastOilChangeMiles ?? null,
    registrationExpirationMonth: truck.registrationExpirationMonth ?? null,
    registrationExpirationYear: truck.registrationExpirationYear ?? null
  }));

  return { officeTargets, truckTargets };
}

export async function recalculateMonthlyCycle(tx: MonthlyTx, month: number, year: number) {
  const cycle = await ensureMonthlyCycle(tx, month, year);
  const { officeTargets, truckTargets } = await getRequiredTargetsForMonth(tx, month, year);

  const requiredOfficeIds = officeTargets.filter((office) => office.required).map((office) => office.id);
  const requiredTruckIds = truckTargets.filter((truck) => truck.required).map((truck) => truck.id);

  const [officeSubmitted, truckSubmitted] = await Promise.all([
    tx.officeInventorySubmission.findMany({
      where: {
        month,
        year,
        officeId: { in: requiredOfficeIds.length ? requiredOfficeIds : ["___none___"] }
      },
      select: { officeId: true }
    }),
    tx.truckInventorySubmission.findMany({
      where: {
        month,
        year,
        truckId: { in: requiredTruckIds.length ? requiredTruckIds : ["___none___"] }
      },
      select: { truckId: true }
    })
  ]);

  const completedOfficeCount = new Set(officeSubmitted.map((entry) => entry.officeId)).size;
  const completedTruckCount = new Set(truckSubmitted.map((entry) => entry.truckId)).size;

  const requiredOfficeCount = requiredOfficeIds.length;
  const requiredTruckCount = requiredTruckIds.length;

  const isComplete =
    completedOfficeCount >= requiredOfficeCount &&
    completedTruckCount >= requiredTruckCount &&
    (requiredOfficeCount > 0 || requiredTruckCount > 0);

  const updatedCycle = await tx.monthlyCycle.update({
    where: { id: cycle.id },
    data: {
      requiredOfficeCount,
      requiredTruckCount,
      completedOfficeCount,
      completedTruckCount,
      isComplete
    }
  });

  return {
    cycle: updatedCycle,
    requiredOfficeIds,
    requiredTruckIds,
    completedOfficeCount,
    completedTruckCount,
    isComplete
  };
}

export async function getMonthlySnapshot(month: number, year: number) {
  const [cycle, entities] = await Promise.all([
    db.monthlyCycle.findUnique({ where: { month_year: { month, year } } }),
    getRequiredTargetsForMonth(db, month, year)
  ]);

  const [officeSubmissions, truckSubmissions] = await Promise.all([
    db.officeInventorySubmission.findMany({
      where: { month, year },
      include: {
        office: true,
        counts: { include: { inventoryItem: true } }
      }
    }),
    db.truckInventorySubmission.findMany({
      where: { month, year },
      include: {
        truck: true,
        counts: { include: { inventoryItem: true } }
      }
    })
  ]);

  const officeSubmissionMap = new Map(officeSubmissions.map((entry) => [entry.officeId, entry]));
  const truckSubmissionMap = new Map(truckSubmissions.map((entry) => [entry.truckId, entry]));
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

  const offices: MonthlySnapshotEntity[] = entities.officeTargets.map((office) => {
    const submission = officeSubmissionMap.get(office.id);
    return {
      ...office,
      submitted: Boolean(submission),
      submissionId: submission?.id,
      technicianName: submission?.technicianName,
      submittedAt: submission?.submittedAt,
      notes: submission?.notes,
      problemsReported: submission?.problemsReported,
      missingDamagedNotes: submission?.missingDamagedNotes,
      counts: submission?.counts
        .slice()
        .sort((a, b) => a.inventoryItem.sortOrder - b.inventoryItem.sortOrder)
        .map((count) => ({ item: count.inventoryItem.name, quantity: count.quantity }))
    };
  });

  const trucks: MonthlySnapshotEntity[] = entities.truckTargets.map((truck) => {
    const submission = truckSubmissionMap.get(truck.id);
    const mileageMetrics = submission ? truckMileageMap.get(submission.id) : undefined;
    const registrationStatus = getRegistrationStatus({
      expirationMonth: truck.registrationExpirationMonth,
      expirationYear: truck.registrationExpirationYear,
      month,
      year
    });
    return {
      ...truck,
      submitted: Boolean(submission),
      submissionId: submission?.id,
      technicianName: submission?.technicianName,
      submittedAt: submission?.submittedAt,
      registrationExpirationMonth: truck.registrationExpirationMonth,
      registrationExpirationYear: truck.registrationExpirationYear,
      lastOilChangeMiles: truck.lastOilChangeMiles,
      registrationStatus,
      odometerMiles: submission?.odometerMiles,
      trackingStartOdometerMiles: mileageMetrics?.trackingStartOdometerMiles,
      previousOdometerMiles: mileageMetrics?.previousOdometerMiles,
      milesDrivenSinceLast: mileageMetrics?.milesDrivenSinceLast,
      milesIntoOilCycle: mileageMetrics?.milesIntoOilCycle,
      milesUntilOilChange: mileageMetrics?.milesUntilOilChange,
      oilChangeProgressPercent: mileageMetrics?.oilChangeProgressPercent,
      oilChangeProgressState: mileageMetrics?.oilChangeProgressState,
      oilChangeCompleted: submission?.oilChangeCompleted,
      maintenanceCheckCompleted: submission?.maintenanceCheckCompleted,
      lastOilChangeDate: submission?.lastOilChangeDate,
      maintenanceNotes: submission?.maintenanceNotes,
      oilChangeDue: mileageMetrics?.oilChangeDue,
      notes: submission?.notes,
      problemsReported: submission?.problemsReported,
      missingDamagedNotes: submission?.missingDamagedNotes,
      counts: submission?.counts
        .slice()
        .sort((a, b) => a.inventoryItem.sortOrder - b.inventoryItem.sortOrder)
        .map((count) => ({ item: count.inventoryItem.name, quantity: count.quantity }))
    };
  });

  const requiredOffices = offices.filter((office) => office.required);
  const requiredTrucks = trucks.filter((truck) => truck.required);

  const completedOfficeCount = requiredOffices.filter((office) => office.submitted).length;
  const completedTruckCount = requiredTrucks.filter((truck) => truck.submitted).length;

  const requiredOfficeCount = requiredOffices.length;
  const requiredTruckCount = requiredTrucks.length;

  const totalRequired = requiredOfficeCount + requiredTruckCount;
  const totalCompleted = completedOfficeCount + completedTruckCount;
  const percentComplete = totalRequired === 0 ? 100 : Math.round((totalCompleted / totalRequired) * 100);
  const isComplete = totalRequired > 0 && totalCompleted >= totalRequired;

  return {
    month,
    year,
    monthKey: monthKey(month, year),
    cycle,
    offices,
    trucks,
    requiredOfficeCount,
    requiredTruckCount,
    completedOfficeCount,
    completedTruckCount,
    totalRequired,
    totalCompleted,
    percentComplete,
    isComplete,
    trucksDueForRegistrationThisMonth: trucks.filter(
      (truck) => truck.registrationStatus === "DUE_THIS_MONTH"
    ),
    expiredRegistrationTrucks: trucks.filter((truck) => truck.registrationStatus === "EXPIRED"),
    trucksMissingRegistrationData: trucks.filter((truck) => truck.registrationStatus === "MISSING"),
    missingOffices: requiredOffices.filter((office) => !office.submitted),
    missingTrucks: requiredTrucks.filter((truck) => !truck.submitted)
  };
}
