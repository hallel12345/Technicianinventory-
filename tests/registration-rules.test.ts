import { describe, expect, it } from "vitest";

import { getRegistrationStatus } from "@/lib/services/registration";

describe("registration status rules", () => {
  it("marks missing when month/year are not both present", () => {
    expect(getRegistrationStatus({ expirationMonth: null, expirationYear: null, month: 4, year: 2026 })).toBe("MISSING");
    expect(getRegistrationStatus({ expirationMonth: 4, expirationYear: null, month: 4, year: 2026 })).toBe("MISSING");
  });

  it("marks due this month when expiration matches current month/year", () => {
    expect(getRegistrationStatus({ expirationMonth: 4, expirationYear: 2026, month: 4, year: 2026 })).toBe(
      "DUE_THIS_MONTH"
    );
  });

  it("marks expired when expiration is before current month/year", () => {
    expect(getRegistrationStatus({ expirationMonth: 3, expirationYear: 2026, month: 4, year: 2026 })).toBe("EXPIRED");
    expect(getRegistrationStatus({ expirationMonth: 12, expirationYear: 2025, month: 4, year: 2026 })).toBe("EXPIRED");
  });

  it("marks up to date when expiration is later than current month/year", () => {
    expect(getRegistrationStatus({ expirationMonth: 5, expirationYear: 2026, month: 4, year: 2026 })).toBe("UP_TO_DATE");
    expect(getRegistrationStatus({ expirationMonth: 1, expirationYear: 2027, month: 4, year: 2026 })).toBe("UP_TO_DATE");
  });
});

