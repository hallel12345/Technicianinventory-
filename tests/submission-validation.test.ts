import { describe, expect, it } from "vitest";

import { technicianSubmissionSchema } from "@/lib/schemas/submission";

describe("technicianSubmissionSchema", () => {
  it("accepts valid payload", () => {
    const payload = {
      officeId: "office-1",
      truckId: "truck-1",
      technicianName: "Tester",
      notes: "all good",
      problemsReported: "",
      missingDamagedNotes: "",
      officeCounts: [
        { itemId: "a", quantity: 1 },
        { itemId: "b", quantity: 0 }
      ],
      truckCounts: [
        { itemId: "a", quantity: 2 },
        { itemId: "b", quantity: 3 }
      ],
      uploadedFileIds: []
    };

    const result = technicianSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects negative counts", () => {
    const result = technicianSubmissionSchema.safeParse({
      officeId: "office-1",
      truckId: "truck-1",
      technicianName: "Tester",
      officeCounts: [{ itemId: "a", quantity: -1 }],
      truckCounts: [{ itemId: "a", quantity: 0 }]
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate office items", () => {
    const result = technicianSubmissionSchema.safeParse({
      officeId: "office-1",
      truckId: "truck-1",
      technicianName: "Tester",
      officeCounts: [
        { itemId: "a", quantity: 1 },
        { itemId: "a", quantity: 2 }
      ],
      truckCounts: [{ itemId: "b", quantity: 1 }]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "officeCounts")).toBe(true);
    }
  });
});
