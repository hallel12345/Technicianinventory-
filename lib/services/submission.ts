import { Prisma, RequirementTargetType, SubmissionStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { technicianSubmissionSchema, type TechnicianSubmissionInput } from "@/lib/schemas/submission";
import { queueAutoFinalEmailLog, sendEmailLog } from "@/lib/services/email";
import { ensureMonthlyCycle, recalculateMonthlyCycle } from "@/lib/services/monthly";
import { getCurrentMonthYear } from "@/lib/time";

export class SubmissionError extends Error {}

export function isDuplicateConstraintError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002";
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: string }).code === "P2002";
  }

  return false;
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createTechnicianSubmission(input: TechnicianSubmissionInput, userId: string) {
  const validated = technicianSubmissionSchema.parse(input);
  const { month, year } = getCurrentMonthYear();

  let queuedAutoEmailLogId: string | null = null;

  try {
    const result = await db.$transaction(async (tx) => {
      const cycle = await ensureMonthlyCycle(tx, month, year);
      if (cycle.isLocked) {
        throw new SubmissionError("This month is locked. Contact an admin to unlock it.");
      }

      const [office, truck, branding] = await Promise.all([
        tx.office.findFirst({ where: { id: validated.officeId, isActive: true } }),
        tx.truck.findFirst({ where: { id: validated.truckId, isActive: true } }),
        tx.brandingConfig.findUnique({ where: { id: "default" } })
      ]);

      if (!office) {
        throw new SubmissionError("Selected office is not available.");
      }
      if (!truck) {
        throw new SubmissionError("Selected truck is not available.");
      }

      if (branding?.photosRequired && (!validated.uploadedFileIds || !validated.uploadedFileIds.length)) {
        throw new SubmissionError("A photo is required before submitting.");
      }

      const officeSubmission = await tx.officeInventorySubmission.create({
        data: {
          month,
          year,
          monthlyCycleId: cycle.id,
          officeId: office.id,
          technicianName: validated.technicianName.trim(),
          notes: normalizeText(validated.notes),
          problemsReported: normalizeText(validated.problemsReported),
          missingDamagedNotes: normalizeText(validated.missingDamagedNotes),
          createdById: userId,
          status: SubmissionStatus.SUBMITTED,
          counts: {
            createMany: {
              data: validated.officeCounts.map((count) => ({
                inventoryItemId: count.itemId,
                quantity: count.quantity
              }))
            }
          }
        }
      });

      const truckSubmission = await tx.truckInventorySubmission.create({
        data: {
          month,
          year,
          monthlyCycleId: cycle.id,
          truckId: truck.id,
          technicianName: validated.technicianName.trim(),
          notes: normalizeText(validated.notes),
          problemsReported: normalizeText(validated.problemsReported),
          missingDamagedNotes: normalizeText(validated.missingDamagedNotes),
          createdById: userId,
          status: SubmissionStatus.SUBMITTED,
          counts: {
            createMany: {
              data: validated.truckCounts.map((count) => ({
                inventoryItemId: count.itemId,
                quantity: count.quantity
              }))
            }
          }
        }
      });

      if (validated.uploadedFileIds?.length) {
        await tx.fileUpload.updateMany({
          where: {
            id: { in: validated.uploadedFileIds },
            uploadedById: userId
          },
          data: {
            officeSubmissionId: officeSubmission.id,
            truckSubmissionId: truckSubmission.id
          }
        });
      }

      const recalc = await recalculateMonthlyCycle(tx, month, year);
      if (recalc.isComplete && !recalc.cycle.autoEmailSent) {
        const log = await queueAutoFinalEmailLog(tx, {
          month,
          year,
          monthlyCycleId: recalc.cycle.id,
          triggeredByUserId: userId,
          triggeredBySubmissionId: truckSubmission.id
        });

        queuedAutoEmailLogId = log?.id ?? null;
      }

      return {
        officeSubmissionId: officeSubmission.id,
        truckSubmissionId: truckSubmission.id,
        month,
        year
      };
    });

    if (queuedAutoEmailLogId) {
      await sendEmailLog(queuedAutoEmailLogId);
    }

    return result;
  } catch (error) {
    if (error instanceof SubmissionError) {
      throw error;
    }

    if (isDuplicateConstraintError(error)) {
      throw new SubmissionError(
        "A submission already exists for this office or truck in the current month. Ask an admin to unlock first."
      );
    }

    throw error;
  }
}

export async function editSubmission(input: {
  submissionType: "office" | "truck";
  submissionId: string;
  technicianName: string;
  notes?: string;
  problemsReported?: string;
  missingDamagedNotes?: string;
  counts: Array<{ itemId: string; quantity: number }>;
  updatedById: string;
}) {
  return db.$transaction(async (tx) => {
    if (input.submissionType === "office") {
      const existing = await tx.officeInventorySubmission.findUnique({
        where: { id: input.submissionId },
        select: { id: true, month: true, year: true, monthlyCycleId: true }
      });

      if (!existing) {
        throw new SubmissionError("Office submission not found.");
      }

      const cycle = await tx.monthlyCycle.findUnique({ where: { id: existing.monthlyCycleId } });
      if (cycle?.isLocked) {
        throw new SubmissionError("Month is locked. Unlock before editing submissions.");
      }

      await tx.officeInventorySubmission.update({
        where: { id: existing.id },
        data: {
          technicianName: input.technicianName,
          notes: normalizeText(input.notes),
          problemsReported: normalizeText(input.problemsReported),
          missingDamagedNotes: normalizeText(input.missingDamagedNotes),
          updatedById: input.updatedById,
          status: SubmissionStatus.EDITED
        }
      });

      await tx.officeInventoryCount.deleteMany({ where: { submissionId: existing.id } });
      await tx.officeInventoryCount.createMany({
        data: input.counts.map((count) => ({
          submissionId: existing.id,
          inventoryItemId: count.itemId,
          quantity: count.quantity
        }))
      });

      await recalculateMonthlyCycle(tx, existing.month, existing.year);
      return existing;
    }

    const existing = await tx.truckInventorySubmission.findUnique({
      where: { id: input.submissionId },
      select: { id: true, month: true, year: true, monthlyCycleId: true }
    });

    if (!existing) {
      throw new SubmissionError("Truck submission not found.");
    }

    const cycle = await tx.monthlyCycle.findUnique({ where: { id: existing.monthlyCycleId } });
    if (cycle?.isLocked) {
      throw new SubmissionError("Month is locked. Unlock before editing submissions.");
    }

    await tx.truckInventorySubmission.update({
      where: { id: existing.id },
      data: {
        technicianName: input.technicianName,
        notes: normalizeText(input.notes),
        problemsReported: normalizeText(input.problemsReported),
        missingDamagedNotes: normalizeText(input.missingDamagedNotes),
        updatedById: input.updatedById,
        status: SubmissionStatus.EDITED
      }
    });

    await tx.truckInventoryCount.deleteMany({ where: { submissionId: existing.id } });
    await tx.truckInventoryCount.createMany({
      data: input.counts.map((count) => ({
        submissionId: existing.id,
        inventoryItemId: count.itemId,
        quantity: count.quantity
      }))
    });

    await recalculateMonthlyCycle(tx, existing.month, existing.year);
    return existing;
  });
}

export async function unlockSubmission(input: {
  submissionType: "office" | "truck";
  submissionId: string;
}) {
  return db.$transaction(async (tx) => {
    if (input.submissionType === "office") {
      const existing = await tx.officeInventorySubmission.findUnique({
        where: { id: input.submissionId },
        select: { id: true, month: true, year: true, monthlyCycleId: true }
      });
      if (!existing) {
        throw new SubmissionError("Office submission not found.");
      }

      const cycle = await tx.monthlyCycle.findUnique({ where: { id: existing.monthlyCycleId } });
      if (cycle?.isLocked) {
        throw new SubmissionError("Month is locked. Unlock month first.");
      }

      await tx.officeInventorySubmission.delete({ where: { id: existing.id } });
      await recalculateMonthlyCycle(tx, existing.month, existing.year);
      return existing;
    }

    const existing = await tx.truckInventorySubmission.findUnique({
      where: { id: input.submissionId },
      select: { id: true, month: true, year: true, monthlyCycleId: true }
    });

    if (!existing) {
      throw new SubmissionError("Truck submission not found.");
    }

    const cycle = await tx.monthlyCycle.findUnique({ where: { id: existing.monthlyCycleId } });
    if (cycle?.isLocked) {
      throw new SubmissionError("Month is locked. Unlock month first.");
    }

    await tx.truckInventorySubmission.delete({ where: { id: existing.id } });
    await recalculateMonthlyCycle(tx, existing.month, existing.year);
    return existing;
  });
}

export async function setMonthLock(month: number, year: number, isLocked: boolean) {
  const cycle = await db.monthlyCycle.upsert({
    where: { month_year: { month, year } },
    update: { isLocked },
    create: { month, year, isLocked }
  });

  return cycle;
}

export async function setRequiredOverride(input: {
  month: number;
  year: number;
  targetType: "OFFICE" | "TRUCK";
  officeId?: string;
  truckId?: string;
  isRequired: boolean;
  reason?: string;
  createdById: string;
}) {
  return db.$transaction(async (tx) => {
    const cycle = await ensureMonthlyCycle(tx, input.month, input.year);

    if (input.targetType === "OFFICE") {
      if (!input.officeId) {
        throw new SubmissionError("officeId is required for office override.");
      }

      await tx.monthlyRequirementOverride.upsert({
        where: {
          month_year_targetType_officeId: {
            month: input.month,
            year: input.year,
            targetType: RequirementTargetType.OFFICE,
            officeId: input.officeId
          }
        },
        update: {
          isRequired: input.isRequired,
          reason: normalizeText(input.reason),
          monthlyCycleId: cycle.id,
          createdById: input.createdById
        },
        create: {
          month: input.month,
          year: input.year,
          targetType: RequirementTargetType.OFFICE,
          officeId: input.officeId,
          isRequired: input.isRequired,
          reason: normalizeText(input.reason),
          monthlyCycleId: cycle.id,
          createdById: input.createdById
        }
      });

      return recalculateMonthlyCycle(tx, input.month, input.year);
    }

    if (!input.truckId) {
      throw new SubmissionError("truckId is required for truck override.");
    }

    await tx.monthlyRequirementOverride.upsert({
      where: {
        month_year_targetType_truckId: {
          month: input.month,
          year: input.year,
          targetType: RequirementTargetType.TRUCK,
          truckId: input.truckId
        }
      },
      update: {
        isRequired: input.isRequired,
        reason: normalizeText(input.reason),
        monthlyCycleId: cycle.id,
        createdById: input.createdById
      },
      create: {
        month: input.month,
        year: input.year,
        targetType: RequirementTargetType.TRUCK,
        truckId: input.truckId,
        isRequired: input.isRequired,
        reason: normalizeText(input.reason),
        monthlyCycleId: cycle.id,
        createdById: input.createdById
      }
    });

    return recalculateMonthlyCycle(tx, input.month, input.year);
  });
}
