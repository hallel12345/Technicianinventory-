import { describe, expect, it } from "vitest";

import { calculateMilesDrivenSinceLast, isOilChangeDue } from "@/lib/services/truck-metrics";

describe("truck mileage metrics", () => {
  it("calculates miles driven when odometer increases", () => {
    expect(calculateMilesDrivenSinceLast(125000, 123450)).toBe(1550);
  });

  it("returns null when there is no previous odometer", () => {
    expect(calculateMilesDrivenSinceLast(125000, null)).toBeNull();
  });

  it("flags oil change due at interval when not completed", () => {
    expect(isOilChangeDue(3000, false)).toBe(true);
    expect(isOilChangeDue(4500, false)).toBe(true);
    expect(isOilChangeDue(2800, false)).toBe(false);
    expect(isOilChangeDue(4500, true)).toBe(false);
  });
});

