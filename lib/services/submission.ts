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

function normalizeDateInput(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return new Date(`${normalized}T00:00:00.000Z`);
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

      const hasStoredRegistrationInfo =
        truck.registrationExpirationMonth !== null &&
        truck.registrationExpirationMonth !== undefined &&
        truck.registrationExpirationYear !== null &&
        truck.registrationExpirationYear !== undefined;
      const hasSubmittedRegistrationInfo =
        validated.registrationExpirationMonth !== undefined &&
        validated.registrationExpirationYear !== undefined;

      if (!hasStoredRegistrationInfo && !hasSubmittedRegistrationInfo) {
        throw new SubmissionError(
          "Registration expiration month/year is required for this truck the first time."
        );
      }

      if (!hasStoredRegistrationInfo && hasSubmittedRegistrationInfo) {
        await tx.truck.update({
          where: { id: truck.id },
          data: {
            registrationExpirationMonth: validated.registrationExpirationMonth,
            registrationExpirationYear: validated.registrationExpirationYear
          }
        });
      }

      if (branding?.photosRequired && (!validated.uploadedFileIds || !validated.uploadedFileIds.length)) {
        throw new SubmissionError("A photo is required before submitting.");
      }

      const existingOfficeSubmission = await tx.officeInventorySubmission.findUnique({
        where: {
          officeId_month_year: {
            officeId: office.id,
            month,
            year
          }
        },
        select: { id: true }
      });

      let officeSubmissionId: string | null = null;

      if (validated.officeAction === "SKIP") {
        if (!existingOfficeSubmission) {
          throw new SubmissionError(
            "Office inventory cannot be skipped because no office submission exists for this month yet."
          );
        }

        officeSubmissionId = existingOfficeSubmission.id;
      } else {
        const officeSubmission = existingOfficeSubmission
          ? await tx.officeInventorySubmission.update({
              where: { id: existingOfficeSubmission.id },
              data: {
                monthlyCycleId: cycle.id,
                technicianName: validated.technicianName.trim(),
                notes: normalizeText(validated.notes),
                problemsReported: normalizeText(validated.problemsReported),
                missingDamagedNotes: normalizeText(validated.missingDamagedNotes),
                updatedById: userId,
                isManuallyUnlocked: false,
                submittedAt: new Date(),
                status: SubmissionStatus.RESUBMITTED
              }
            })
          : await tx.officeInventorySubmission.create({
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
                status: SubmissionStatus.SUBMITTED
              }
            });

        await tx.officeInventoryCount.deleteMany({ where: { submissionId: officeSubmission.id } });
        await tx.officeInventoryCount.createMany({
          data: validated.officeCounts.map((count) => ({
            submissionId: officeSubmission.id,
            inventoryItemId: count.itemId,
            quantity: count.quantity
          }))
        });

        officeSubmissionId = officeSubmission.id;
      }

      const existingTruckSubmission = await tx.truckInventorySubmission.findUnique({
        where: {
          truckId_month_year: {
            truckId: truck.id,
            month,
            year
          }
        },
        select: { id: true }
      });

      const nextLastOilChangeMiles = validated.oilChangeCompleted
        ? validated.odometerMiles
        : validated.lastOilChangeMiles;

      const truckSubmission = existingTruckSubmission
        ? await tx.truckInventorySubmission.update({
            where: { id: existingTruckSubmission.id },
            data: {
              monthlyCycleId: cycle.id,
              technicianName: validated.technicianName.trim(),
              odometerMiles: validated.odometerMiles,
              oilChangeCompleted: validated.oilChangeCompleted,
              maintenanceCheckCompleted: validated.maintenanceCheckCompleted,
              lastOilChangeDate: normalizeDateInput(validated.lastOilChangeDate),
              maintenanceNotes: normalizeText(validated.maintenanceNotes),
              notes: normalizeText(validated.notes),
              problemsReported: normalizeText(validated.problemsReported),
              missingDamagedNotes: normalizeText(validated.missingDamagedNotes),
              updatedById: userId,
              isManuallyUnlocked: false,
              submittedAt: new Date(),
              status: SubmissionStatus.RESUBMITTED
            }
          })
        : await tx.truckInventorySubmission.create({
            data: {
              month,
              year,
              monthlyCycleId: cycle.id,
              truckId: truck.id,
              technicianName: validated.technicianName.trim(),
              odometerMiles: validated.odometerMiles,
              oilChangeCompleted: validated.oilChangeCompleted,
              maintenanceCheckCompleted: validated.maintenanceCheckCompleted,
              lastOilChangeDate: normalizeDateInput(validated.lastOilChangeDate),
              maintenanceNotes: normalizeText(validated.maintenanceNotes),
              notes: normalizeText(validated.notes),
              problemsReported: normalizeText(validated.problemsReported),
              missingDamagedNotes: normalizeText(validated.missingDamagedNotes),
              createdById: userId,
              status: SubmissionStatus.SUBMITTED
            }
          });

      if (nextLastOilChangeMiles !== undefined) {
        await tx.truck.update({
          where: { id: truck.id },
          data: { lastOilChangeMiles: nextLastOilChangeMiles }
        });
      }

      await tx.truckInventoryCount.deleteMany({ where: { submissionId: truckSubmission.id } });
      await tx.truckInventoryCount.createMany({
        data: validated.truckCounts.map((count) => ({
          submissionId: truckSubmission.id,
          inventoryItemId: count.itemId,
          quantity: count.quantity
        }))
      });

      if (validated.uploadedFileIds?.length) {
        const fileAssociationUpdate: {
          officeSubmissionId?: string;
          truckSubmissionId: string;
        } = { truckSubmissionId: truckSubmission.id };

        if (validated.officeAction !== "SKIP" && officeSubmissionId) {
          fileAssociationUpdate.officeSubmissionId = officeSubmissionId;
        }

        await tx.fileUpload.updateMany({
          where: {
            id: { in: validated.uploadedFileIds },
            uploadedById: userId
          },
          data: fileAssociationUpdate
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
        officeSubmissionId,
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

    throw error;
  }
}

export async function editSubmission(input: {
  submissionType: "office" | "truck";
  submissionId: string;
  technicianName: string;
  odometerMiles?: number;
  lastOilChangeMiles?: number;
  oilChangeCompleted?: boolean;
  maintenanceCheckCompleted?: boolean;
  lastOilChangeDate?: string;
  maintenanceNotes?: string;
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
      select: { id: true, month: true, year: true, monthlyCycleId: true, truckId: true }
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
        odometerMiles: input.odometerMiles,
        oilChangeCompleted: input.oilChangeCompleted,
        maintenanceCheckCompleted: input.maintenanceCheckCompleted,
        lastOilChangeDate: normalizeDateInput(input.lastOilChangeDate),
        maintenanceNotes: normalizeText(input.maintenanceNotes),
        notes: normalizeText(input.notes),
        problemsReported: normalizeText(input.problemsReported),
        missingDamagedNotes: normalizeText(input.missingDamagedNotes),
        updatedById: input.updatedById,
        status: SubmissionStatus.EDITED
      }
    });

    const nextLastOilChangeMiles = input.oilChangeCompleted
      ? input.odometerMiles
      : input.lastOilChangeMiles;

    if (nextLastOilChangeMiles !== undefined) {
      await tx.truck.update({
        where: { id: existing.truckId },
        data: { lastOilChangeMiles: nextLastOilChangeMiles }
      });
    }

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
