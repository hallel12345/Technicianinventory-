import { describe, expect, it } from "vitest";

import {
  calculateMilesDrivenSinceLast,
  calculateOilCycleProgress,
  getOilProgressState,
  isOilChangeDueByProgress
} from "@/lib/services/truck-metrics";

describe("truck mileage metrics", () => {
  it("calculates miles driven when odometer increases", () => {
    expect(calculateMilesDrivenSinceLast(125000, 123450)).toBe(1550);
  });

  it("returns null when there is no previous odometer", () => {
    expect(calculateMilesDrivenSinceLast(125000, null)).toBeNull();
  });

  it("computes 5k oil cycle progress and auto-reset behavior", () => {
    const at4500 = calculateOilCycleProgress(104500, 100000);
    expect(at4500.milesIntoOilCycle).toBe(4500);
    expect(at4500.milesUntilOilChange).toBe(500);
    expect(at4500.oilChangeProgressPercent).toBe(90);

    const resetAt5000 = calculateOilCycleProgress(105000, 100000);
    expect(resetAt5000.milesIntoOilCycle).toBe(0);
    expect(resetAt5000.milesUntilOilChange).toBe(5000);
    expect(resetAt5000.oilChangeProgressPercent).toBe(0);
  });

  it("uses explicit last-oil-change baseline mileage when available", () => {
    const progress = calculateOilCycleProgress(208250, 205000);
    expect(progress.milesIntoOilCycle).toBe(3250);
    expect(progress.milesUntilOilChange).toBe(1750);
    expect(progress.oilChangeProgressPercent).toBe(65);
  });

  it("returns null cycle progress when baseline miles are greater than odometer", () => {
    const progress = calculateOilCycleProgress(100000, 100500);
    expect(progress.milesIntoOilCycle).toBeNull();
    expect(progress.milesUntilOilChange).toBeNull();
    expect(progress.oilChangeProgressPercent).toBeNull();
  });

  it("maps progress percent to state and due flag", () => {
    expect(getOilProgressState(20)).toBe("green");
    expect(getOilProgressState(70)).toBe("yellow");
    expect(getOilProgressState(90)).toBe("red");
    expect(isOilChangeDueByProgress(90)).toBe(true);
    expect(isOilChangeDueByProgress(70)).toBe(false);
  });
});
