import { InventoryScope, Role } from "@prisma/client";
import { z } from "zod";

export const officeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  isActive: z.boolean().default(true),
  requiredByDefault: z.boolean().default(true)
});

export const truckSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  licensePlate: z.string().min(2),
  officeId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  requiredByDefault: z.boolean().default(true)
});

export const inventoryItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  scope: z.nativeEnum(InventoryScope),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0)
});

export const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  role: z.nativeEnum(Role),
  email: z.string().email().optional().or(z.literal("")),
  userCode: z.string().optional().or(z.literal("")),
  officeId: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  isActive: z.boolean().default(true)
});

export const requirementOverrideSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024),
  targetType: z.enum(["OFFICE", "TRUCK"]),
  officeId: z.string().optional(),
  truckId: z.string().optional(),
  isRequired: z.boolean(),
  reason: z.string().max(500).optional(),
  monthLocked: z.boolean().optional()
});

export const brandingSchema = z.object({
  companyName: z.string().min(2),
  appTitle: z.string().min(2),
  logoPath: z.string().min(1),
  faviconPath: z.string().min(1),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  photosRequired: z.boolean()
});

export const submissionEditSchema = z
  .object({
    submissionType: z.enum(["office", "truck"]),
    submissionId: z.string().min(1),
    technicianName: z.string().min(2),
    odometerMiles: z.number().int().min(0).optional(),
    oilChangeCompleted: z.boolean().optional(),
    maintenanceCheckCompleted: z.boolean().optional(),
    lastOilChangeDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid oil change date")
      .optional()
      .or(z.literal("")),
    maintenanceNotes: z.string().optional(),
    notes: z.string().optional(),
    problemsReported: z.string().optional(),
    missingDamagedNotes: z.string().optional(),
    counts: z.array(z.object({ itemId: z.string(), quantity: z.number().int().min(0) }))
  })
  .superRefine((value, ctx) => {
    if (value.submissionType === "truck" && value.odometerMiles === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["odometerMiles"],
        message: "Truck mileage is required."
      });
    }
  });
