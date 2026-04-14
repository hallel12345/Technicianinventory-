import { z } from "zod";

export const inventoryCountSchema = z.object({
  itemId: z.string().min(1),
  quantity: z
    .number({ invalid_type_error: "Enter a whole number" })
    .int("Count must be an integer")
    .min(0, "Count cannot be negative")
});

const technicianSubmissionBaseSchema = z.object({
  officeId: z.string().min(1, "Office is required"),
  officeAction: z.enum(["UPDATE", "SKIP"]).default("UPDATE"),
  truckId: z.string().min(1, "Truck is required"),
  registrationExpirationMonth: z.number().int().min(1).max(12).optional(),
  registrationExpirationYear: z.number().int().min(2020).max(2100).optional(),
  odometerMiles: z
    .number({ invalid_type_error: "Enter whole miles" })
    .int("Mileage must be an integer")
    .min(0, "Mileage cannot be negative"),
  oilChangeCompleted: z.boolean().default(false),
  maintenanceCheckCompleted: z.boolean().default(false),
  lastOilChangeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid oil change date")
    .optional()
    .or(z.literal("")),
  maintenanceNotes: z.string().max(2000).optional(),
  technicianName: z.string().min(2, "Technician name is required"),
  notes: z.string().max(2000).optional(),
  problemsReported: z.string().max(2000).optional(),
  missingDamagedNotes: z.string().max(2000).optional(),
  officeCounts: z.array(inventoryCountSchema).min(1),
  truckCounts: z.array(inventoryCountSchema).min(1),
  uploadedFileIds: z.array(z.string()).optional()
});

export const technicianSubmissionSchema = technicianSubmissionBaseSchema
  .superRefine((value, ctx) => {
    const hasRegistrationMonth = value.registrationExpirationMonth !== undefined;
    const hasRegistrationYear = value.registrationExpirationYear !== undefined;

    if (hasRegistrationMonth !== hasRegistrationYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide both registration month and year.",
        path: ["registrationExpirationMonth"]
      });
    }

    const hasDuplicateOfficeItems =
      new Set(value.officeCounts.map((entry) => entry.itemId)).size !== value.officeCounts.length;
    const hasDuplicateTruckItems =
      new Set(value.truckCounts.map((entry) => entry.itemId)).size !== value.truckCounts.length;

    if (hasDuplicateOfficeItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate office inventory items found.",
        path: ["officeCounts"]
      });
    }

    if (hasDuplicateTruckItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate truck inventory items found.",
        path: ["truckCounts"]
      });
    }
  });

export type TechnicianSubmissionInput = z.infer<typeof technicianSubmissionSchema>;

export const draftSchema = technicianSubmissionBaseSchema.partial();
