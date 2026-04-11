import { describe, expect, it } from "vitest";

import { isDuplicateConstraintError } from "@/lib/services/submission";

describe("duplicate constraint detection", () => {
  it("detects prisma duplicate code", () => {
    expect(isDuplicateConstraintError({ code: "P2002" })).toBe(true);
  });

  it("ignores non-duplicate errors", () => {
    expect(isDuplicateConstraintError({ code: "OTHER" })).toBe(false);
    expect(isDuplicateConstraintError(new Error("x"))).toBe(false);
  });
});
