export type CompletionResult = {
  requiredOfficeCount: number;
  requiredTruckCount: number;
  completedOfficeCount: number;
  completedTruckCount: number;
  isComplete: boolean;
  percentComplete: number;
};

export function calculateCompletion(input: {
  requiredOfficeIds: string[];
  requiredTruckIds: string[];
  submittedOfficeIds: string[];
  submittedTruckIds: string[];
}): CompletionResult {
  const requiredOfficeSet = new Set(input.requiredOfficeIds);
  const requiredTruckSet = new Set(input.requiredTruckIds);

  const completedOfficeCount = new Set(
    input.submittedOfficeIds.filter((officeId) => requiredOfficeSet.has(officeId))
  ).size;
  const completedTruckCount = new Set(
    input.submittedTruckIds.filter((truckId) => requiredTruckSet.has(truckId))
  ).size;

  const requiredOfficeCount = requiredOfficeSet.size;
  const requiredTruckCount = requiredTruckSet.size;
  const totalRequired = requiredOfficeCount + requiredTruckCount;
  const totalCompleted = completedOfficeCount + completedTruckCount;

  const isComplete =
    totalRequired > 0 &&
    completedOfficeCount >= requiredOfficeCount &&
    completedTruckCount >= requiredTruckCount;

  return {
    requiredOfficeCount,
    requiredTruckCount,
    completedOfficeCount,
    completedTruckCount,
    isComplete,
    percentComplete: totalRequired === 0 ? 100 : Math.round((totalCompleted / totalRequired) * 100)
  };
}

export function applyRequiredOverrides<T extends { id: string; requiredByDefault: boolean }>(
  entities: T[],
  overrides: Record<string, boolean>
) {
  return entities.map((entity) => ({
    ...entity,
    required: overrides[entity.id] ?? entity.requiredByDefault
  }));
}

export function shouldQueueAutoEmail(input: {
  isComplete: boolean;
  autoEmailSent: boolean;
  hasExistingAutoLog: boolean;
}) {
  return input.isComplete && !input.autoEmailSent && !input.hasExistingAutoLog;
}

export function ensureMonthUnlocked(isLocked: boolean) {
  if (isLocked) {
    throw new Error("Month is locked.");
  }
}
