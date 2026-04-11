import type { Prisma } from "@prisma/client";

const OIL_CHANGE_INTERVAL_MILES = 3000;

type TruckMetricsClient = Pick<Prisma.TransactionClient, "truckInventorySubmission">;

export type TruckMileageMetrics = {
  previousOdometerMiles: number | null;
  milesDrivenSinceLast: number | null;
  oilChangeDue: boolean;
};

type TruckSubmissionForMetrics = {
  id: string;
  truckId: string;
  month: number;
  year: number;
  odometerMiles: number;
  oilChangeCompleted?: boolean;
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

export function isOilChangeDue(milesDrivenSinceLast: number | null, oilChangeCompleted?: boolean) {
  if (oilChangeCompleted) {
    return false;
  }
  return milesDrivenSinceLast !== null && milesDrivenSinceLast >= OIL_CHANGE_INTERVAL_MILES;
}

export async function getTruckMileageMetricsMap(
  client: TruckMetricsClient,
  submissions: TruckSubmissionForMetrics[]
) {
  const metrics = await Promise.all(
    submissions.map(async (submission) => {
      const previous = await client.truckInventorySubmission.findFirst({
        where: {
          truckId: submission.truckId,
          OR: [{ year: { lt: submission.year } }, { year: submission.year, month: { lt: submission.month } }]
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { odometerMiles: true }
      });

      const previousOdometerMiles = previous?.odometerMiles ?? null;
      const milesDrivenSinceLast = calculateMilesDrivenSinceLast(submission.odometerMiles, previousOdometerMiles);

      return [
        submission.id,
        {
          previousOdometerMiles,
          milesDrivenSinceLast,
          oilChangeDue: isOilChangeDue(milesDrivenSinceLast, submission.oilChangeCompleted)
        } satisfies TruckMileageMetrics
      ] as const;
    })
  );

  return new Map(metrics);
}

