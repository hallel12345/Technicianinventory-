import { describe, expect, it } from "vitest";

import {
  applyRequiredOverrides,
  calculateCompletion,
  ensureMonthUnlocked,
  shouldQueueAutoEmail
} from "@/lib/services/rules";

describe("monthly rules", () => {
  it("calculates completion and percentage correctly", () => {
    const result = calculateCompletion({
      requiredOfficeIds: ["o1", "o2"],
      requiredTruckIds: ["t1", "t2"],
      submittedOfficeIds: ["o1"],
      submittedTruckIds: ["t1", "t2"]
    });

    expect(result.completedOfficeCount).toBe(1);
    expect(result.completedTruckCount).toBe(2);
    expect(result.requiredOfficeCount).toBe(2);
    expect(result.requiredTruckCount).toBe(2);
    expect(result.isComplete).toBe(false);
    expect(result.percentComplete).toBe(75);
  });

  it("applies required overrides", () => {
    const entities = [
      { id: "1", requiredByDefault: true },
      { id: "2", requiredByDefault: false }
    ];

    const result = applyRequiredOverrides(entities, { "1": false, "2": true });

    expect(result[0].required).toBe(false);
    expect(result[1].required).toBe(true);
  });

  it("throws on locked month", () => {
    expect(() => ensureMonthUnlocked(true)).toThrow("Month is locked.");
    expect(() => ensureMonthUnlocked(false)).not.toThrow();
  });

  it("queues auto email only for complete unsent month without existing log", () => {
    expect(
      shouldQueueAutoEmail({
        isComplete: true,
        autoEmailSent: false,
        hasExistingAutoLog: false
      })
    ).toBe(true);

    expect(
      shouldQueueAutoEmail({
        isComplete: false,
        autoEmailSent: false,
        hasExistingAutoLog: false
      })
    ).toBe(false);
  });
});
