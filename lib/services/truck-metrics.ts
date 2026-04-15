import type { Prisma } from "@prisma/client";

export const OIL_CHANGE_INTERVAL_MILES = 5000;

type TruckMetricsClient = Pick<Prisma.TransactionClient, "truckInventorySubmission" | "truck">;

export type TruckMileageMetrics = {
  trackingStartOdometerMiles: number | null;
  previousOdometerMiles: number | null;
  milesDrivenSinceLast: number | null;
  milesIntoOilCycle: number | null;
  milesUntilOilChange: number | null;
  oilChangeProgressPercent: number | null;
  oilChangeProgressState: "green" | "yellow" | "red";
  oilChangeDue: boolean;
};

type TruckSubmissionForMetrics = {
  id: string;
  truckId: string;
  month: number;
  year: number;
  odometerMiles: number;
};

export function calculateMilesDrivenSinceLast(
  currentOdometerMiles: number,
  previousOdometerMiles?: number | null
) {
  if (previousOdometerMiles === null || previousOdometerMiles === undefined) {
    return null;
  }

  const delta = currentOdometerMiles - previousOdometerMiles;
  return delta >= 0 ? delta : null;
}

export function calculateOilCycleProgress(
  currentOdometerMiles: number,
  trackingStartOdometerMiles?: number | null
) {
  if (trackingStartOdometerMiles === null || trackingStartOdometerMiles === undefined) {
    return {
      milesIntoOilCycle: null,
      milesUntilOilChange: null,
      oilChangeProgressPercent: null
    };
  }

  const milesSinceTrackingStart = currentOdometerMiles - trackingStartOdometerMiles;
  if (milesSinceTrackingStart < 0) {
    return {
      milesIntoOilCycle: null,
      milesUntilOilChange: null,
      oilChangeProgressPercent: null
    };
  }

  const milesIntoOilCycle = milesSinceTrackingStart % OIL_CHANGE_INTERVAL_MILES;
  const oilChangeProgressPercent = Math.round((milesIntoOilCycle / OIL_CHANGE_INTERVAL_MILES) * 100);
  const milesUntilOilChange =
    milesIntoOilCycle === 0 ? OIL_CHANGE_INTERVAL_MILES : OIL_CHANGE_INTERVAL_MILES - milesIntoOilCycle;

  return {
    milesIntoOilCycle,
    milesUntilOilChange,
    oilChangeProgressPercent
  };
}

export function getOilProgressState(percent: number | null): "green" | "yellow" | "red" {
  if (percent === null) {
    return "green";
  }
  if (percent >= 85) {
    return "red";
  }
  if (percent >= 60) {
    return "yellow";
  }
  return "green";
}

export function isOilChangeDueByProgress(percent: number | null) {
  return percent !== null && percent >= 85;
}

export async function getTruckMileageMetricsMap(
  client: TruckMetricsClient,
  submissions: TruckSubmissionForMetrics[]
) {
  const metrics = await Promise.all(
    submissions.map(async (submission) => {
      const [previous, firstRecorded, truck] = await Promise.all([
        client.truckInventorySubmission.findFirst({
          where: {
            truckId: submission.truckId,
            OR: [{ year: { lt: submission.year } }, { year: submission.year, month: { lt: submission.month } }]
          },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          select: { odometerMiles: true }
        }),
        client.truckInventorySubmission.findFirst({
          where: {
            truckId: submission.truckId
          },
          orderBy: [{ year: "asc" }, { month: "asc" }],
          select: { odometerMiles: true }
        }),
        client.truck.findUnique({
          where: { id: submission.truckId },
          select: { lastOilChangeMiles: true }
        })
      ]);

      const previousOdometerMiles = previous?.odometerMiles ?? null;
      const trackingStartOdometerMiles = truck?.lastOilChangeMiles ?? firstRecorded?.odometerMiles ?? null;
      const milesDrivenSinceLast = calculateMilesDrivenSinceLast(submission.odometerMiles, previousOdometerMiles);
      const oilCycleProgress = calculateOilCycleProgress(submission.odometerMiles, trackingStartOdometerMiles);
      const oilChangeProgressState = getOilProgressState(oilCycleProgress.oilChangeProgressPercent);

      return [
        submission.id,
        {
          trackingStartOdometerMiles,
          previousOdometerMiles,
          milesDrivenSinceLast,
          milesIntoOilCycle: oilCycleProgress.milesIntoOilCycle,
          milesUntilOilChange: oilCycleProgress.milesUntilOilChange,
          oilChangeProgressPercent: oilCycleProgress.oilChangeProgressPercent,
          oilChangeProgressState,
          oilChangeDue: isOilChangeDueByProgress(oilCycleProgress.oilChangeProgressPercent)
        } satisfies TruckMileageMetrics
      ] as const;
    })
  );

  return new Map(metrics);
}
