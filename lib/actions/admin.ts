"use server";

import bcrypt from "bcryptjs";
import { AuditAction, InventoryScope, RequirementTargetType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  brandingSchema,
  inventoryItemSchema,
  officeSchema,
  requirementOverrideSchema,
  submissionEditSchema,
  truckSchema,
  userSchema
} from "@/lib/schemas/admin";
import { logAudit } from "@/lib/services/audit";
import { createAndSendManualResend } from "@/lib/services/email";
import {
  editSubmission,
  setMonthLock,
  setRequiredOverride,
  SubmissionError,
  unlockSubmission
} from "@/lib/services/submission";

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

async function assertAnotherActiveAdminExists(excludingUserId: string) {
  const activeAdminCount = await db.user.count({
    where: {
      role: Role.ADMIN,
      isActive: true,
      id: { not: excludingUserId }
    }
  });

  if (!activeAdminCount) {
    throw new Error("At least one active admin must remain.");
  }
}

export async function saveOfficeAction(rawInput: unknown) {
  const admin = await requireAdminSession();
  const input = officeSchema.parse(rawInput);

  const office = await db.office.upsert({
    where: { id: input.id ?? "" },
    update: {
      name: input.name,
      isActive: input.isActive,
      requiredByDefault: input.requiredByDefault
    },
    create: {
      name: input.name,
      isActive: input.isActive,
      requiredByDefault: input.requiredByDefault
    }
  });

  await logAudit({
    action: input.id ? AuditAction.OFFICE_UPDATED : AuditAction.OFFICE_CREATED,
    entityType: "Office",
    entityId: office.id,
    actorId: admin.id,
    description: `${input.id ? "Updated" : "Created"} office ${office.name}`,
    metadata: input
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true };
}

export async function saveTruckAction(rawInput: unknown) {
  const admin = await requireAdminSession();
  const input = truckSchema.parse(rawInput);
  const existing = input.id ? await db.truck.findUnique({ where: { id: input.id } }) : null;

  const truck = await db.truck.upsert({
    where: { id: input.id ?? "" },
    update: {
      name: input.name,
      licensePlate: input.licensePlate,
      registrationExpirationMonth: input.registrationExpirationMonth ?? null,
      registrationExpirationYear: input.registrationExpirationYear ?? null,
      officeId: input.officeId ?? null,
      isActive: input.isActive,
      requiredByDefault: input.requiredByDefault
    },
    create: {
      name: input.name,
      licensePlate: input.licensePlate,
      registrationExpirationMonth: input.registrationExpirationMonth ?? null,
      registrationExpirationYear: input.registrationExpirationYear ?? null,
      officeId: input.officeId ?? null,
      isActive: input.isActive,
      requiredByDefault: input.requiredByDefault
    }
  });

  await logAudit({
    action: input.id ? AuditAction.TRUCK_UPDATED : AuditAction.TRUCK_CREATED,
    entityType: "Truck",
    entityId: truck.id,
    actorId: admin.id,
    description: `${input.id ? "Updated" : "Created"} truck ${truck.name}`,
    metadata: input
  });

  if (existing && existing.officeId !== (input.officeId ?? null)) {
    await logAudit({
      action: AuditAction.TRUCK_ASSIGNMENT_CHANGED,
      entityType: "Truck",
      entityId: truck.id,
      actorId: admin.id,
      description: `Reassigned truck ${truck.name}`,
      metadata: {
        fromOfficeId: existing.officeId,
        toOfficeId: input.officeId ?? null
      }
    });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true };
}

export async function saveInventoryItemAction(rawInput: unknown) {
  const admin = await requireAdminSession();
  const input = inventoryItemSchema.parse(rawInput);

  const item = await db.inventoryItem.upsert({
    where: { id: input.id ?? "" },
    update: {
      name: input.name,
      scope: input.scope,
      isActive: input.isActive,
      sortOrder: input.sortOrder
    },
    create: {
      name: input.name,
      scope: input.scope,
      isActive: input.isActive,
      sortOrder: input.sortOrder
    }
  });

  await logAudit({
    action: input.id ? AuditAction.INVENTORY_ITEM_UPDATED : AuditAction.INVENTORY_ITEM_CREATED,
    entityType: "InventoryItem",
    entityId: item.id,
    actorId: admin.id,
    description: `${input.id ? "Updated" : "Created"} item ${item.name}`,
    metadata: input
  });

  revalidatePath("/admin/settings");
  revalidatePath("/inventory");
  return { success: true };
}

export async function saveUserAction(rawInput: unknown) {
  const admin = await requireAdminSession();
  const input = userSchema.parse(rawInput);
  const existing = input.id ? await db.user.findUnique({ where: { id: input.id } }) : null;

  const isTechnician = input.role === Role.TECHNICIAN;
  if (!isTechnician && !input.email && !input.id) {
    throw new Error("Admins require an email.");
  }
  if (!input.id && isTechnician && !input.pin) {
    throw new Error("Technicians require a 4-digit PIN on create.");
  }
  if (!input.id && !isTechnician && !input.password) {
    throw new Error("Admins require a password on create.");
  }
  if (existing && input.role === Role.ADMIN && !existing.passwordHash && !input.password) {
    throw new Error("Set a password for this admin account.");
  }
  if (existing && input.role === Role.TECHNICIAN && !existing.pinHash && !input.pin) {
    throw new Error("Set a 4-digit PIN for this technician account.");
  }

  if (existing) {
    const willStayAdmin = input.role === Role.ADMIN;
    const willStayActive = input.isActive;
    const adminPrivilegesRemoved = existing.role === Role.ADMIN && existing.isActive && (!willStayAdmin || !willStayActive);

    if (existing.id === admin.id && adminPrivilegesRemoved) {
      throw new Error("You cannot deactivate your own admin account while signed in.");
    }

    if (adminPrivilegesRemoved) {
      await assertAnotherActiveAdminExists(existing.id);
    }
  }

  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
  const pinHash = input.pin ? await bcrypt.hash(input.pin, 12) : undefined;

  const user = await db.user.upsert({
    where: { id: input.id ?? "" },
    update: {
      name: input.name,
      role: input.role,
      email: input.email || null,
      userCode: input.userCode || null,
      officeId: input.officeId ?? null,
      isActive: input.isActive,
      passwordHash: passwordHash ?? undefined,
      pinHash: pinHash ?? undefined
    },
    create: {
      name: input.name,
      role: input.role,
      email: input.email || null,
      userCode: input.userCode || null,
      officeId: input.officeId ?? null,
      isActive: input.isActive,
      passwordHash,
      pinHash
    }
  });

  await logAudit({
    action: !input.id && user.role === Role.TECHNICIAN ? AuditAction.TECHNICIAN_CREATED : AuditAction.USER_UPDATED,
    entityType: "User",
    entityId: user.id,
    actorId: admin.id,
    description: `Saved user ${user.name}`,
    metadata: {
      role: user.role,
      isActive: user.isActive
    }
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateBrandingAction(rawInput: unknown) {
  const admin = await requireAdminSession();
  const input = brandingSchema.parse(rawInput);

  await db.brandingConfig.upsert({
    where: { id: "default" },
    update: {
      companyName: input.companyName,
      appTitle: input.appTitle,
      logoPath: input.logoPath,
      faviconPath: input.faviconPath,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      textColor: input.textColor,
      photosRequired: input.photosRequired,
      updatedById: admin.id
    },
    create: {
      id: "default",
      companyName: input.companyName,
      appTitle: input.appTitle,
      logoPath: input.logoPath,
      faviconPath: input.faviconPath,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      textColor: input.textColor,
      photosRequired: input.photosRequired,
      updatedById: admin.id
    }
  });

  await logAudit({
    action: AuditAction.BRANDING_UPDATED,
    entityType: "BrandingConfig",
    entityId: "default",
    actorId: admin.id,
    description: "Updated branding configuration",
    metadata: input
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
  revalidatePath("/inventory");

  return { success: true };
}

export async function setRequiredOverrideAction(rawInput: unknown) {
  const admin = await requireAdminSession();
  const input = requirementOverrideSchema.parse(rawInput);

  await setRequiredOverride({
    month: input.month,
    year: input.year,
    targetType: input.targetType,
    officeId: input.officeId,
    truckId: input.truckId,
    isRequired: input.isRequired,
    reason: input.reason,
    createdById: admin.id
  });

  await logAudit({
    action: AuditAction.REQUIRED_STATUS_CHANGED,
    entityType: input.targetType === "OFFICE" ? "Office" : "Truck",
    entityId: input.officeId ?? input.truckId,
    actorId: admin.id,
    description: `Set ${input.targetType} required status to ${input.isRequired}`,
    metadata: input
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function setMonthLockAction(month: number, year: number, isLocked: boolean) {
  const admin = await requireAdminSession();

  await setMonthLock(month, year, isLocked);
  await logAudit({
    action: isLocked ? AuditAction.MONTH_LOCKED : AuditAction.MONTH_UNLOCKED,
    entityType: "MonthlyCycle",
    entityId: `${year}-${month}`,
    actorId: admin.id,
    description: `${isLocked ? "Locked" : "Unlocked"} month ${month}/${year}`
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function editSubmissionAction(rawInput: unknown) {
  const admin = await requireAdminSession();

  try {
    const input = submissionEditSchema.parse(rawInput);

    await editSubmission({
      ...input,
      updatedById: admin.id
    });

    await logAudit({
      action: AuditAction.SUBMISSION_EDITED,
      entityType: input.submissionType === "office" ? "OfficeInventorySubmission" : "TruckInventorySubmission",
      entityId: input.submissionId,
      actorId: admin.id,
      description: `Edited ${input.submissionType} submission`,
      metadata: {
        technicianName: input.technicianName,
        countCount: input.counts.length,
        odometerMiles: input.submissionType === "truck" ? input.odometerMiles : undefined,
        lastOilChangeMiles: input.submissionType === "truck" ? input.lastOilChangeMiles : undefined,
        lastOilChangeDate: input.submissionType === "truck" ? input.lastOilChangeDate : undefined
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/submissions");
    return { success: true };
  } catch (error) {
    if (error instanceof SubmissionError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to edit submission." };
  }
}

export async function unlockSubmissionAction(submissionType: "office" | "truck", submissionId: string) {
  const admin = await requireAdminSession();

  try {
    await unlockSubmission({ submissionType, submissionId });

    await logAudit({
      action: AuditAction.SUBMISSION_UNLOCKED,
      entityType: submissionType === "office" ? "OfficeInventorySubmission" : "TruckInventorySubmission",
      entityId: submissionId,
      actorId: admin.id,
      description: `Unlocked ${submissionType} submission by deleting it for resubmission.`
    });

    revalidatePath("/admin");
    revalidatePath("/admin/submissions");
    return { success: true };
  } catch (error) {
    if (error instanceof SubmissionError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to unlock submission." };
  }
}

export async function resendMonthlySummaryAction(month: number, year: number) {
  const admin = await requireAdminSession();

  const result = await createAndSendManualResend({
    month,
    year,
    actorId: admin.id
  });

  await logAudit({
    action: AuditAction.MONTHLY_EMAIL_RESEND,
    entityType: "EmailLog",
    entityId: `${year}-${month}`,
    actorId: admin.id,
    description: `Manual monthly email resend for ${month}/${year}`,
    metadata: { month, year, sent: result.ok }
  });

  revalidatePath("/admin");
  return result;
}

export async function archiveEntityAction(
  entityType: "office" | "truck" | "inventoryItem" | "user",
  id: string,
  isActive: boolean
) {
  const admin = await requireAdminSession();

  if (entityType === "office") {
    await db.office.update({ where: { id }, data: { isActive } });
    await logAudit({
      action: isActive ? AuditAction.OFFICE_UPDATED : AuditAction.OFFICE_ARCHIVED,
      entityType: "Office",
      entityId: id,
      actorId: admin.id,
      description: `${isActive ? "Activated" : "Archived"} office`
    });
  } else if (entityType === "truck") {
    await db.truck.update({ where: { id }, data: { isActive } });
    await logAudit({
      action: isActive ? AuditAction.TRUCK_UPDATED : AuditAction.TRUCK_ARCHIVED,
      entityType: "Truck",
      entityId: id,
      actorId: admin.id,
      description: `${isActive ? "Activated" : "Archived"} truck`
    });
  } else if (entityType === "inventoryItem") {
    await db.inventoryItem.update({ where: { id }, data: { isActive } });
    await logAudit({
      action: isActive ? AuditAction.INVENTORY_ITEM_UPDATED : AuditAction.INVENTORY_ITEM_ARCHIVED,
      entityType: "InventoryItem",
      entityId: id,
      actorId: admin.id,
      description: `${isActive ? "Activated" : "Archived"} inventory item`
    });
  } else {
    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, name: true }
    });

    if (!targetUser) {
      throw new Error("User not found.");
    }

    if (!isActive) {
      if (targetUser.id === admin.id) {
        throw new Error("You cannot deactivate your own admin account while signed in.");
      }

      if (targetUser.role === Role.ADMIN) {
        await assertAnotherActiveAdminExists(targetUser.id);
      }
    }

    await db.user.update({
      where: { id },
      data: isActive
        ? { isActive: true, failedLoginAttempts: 0, lockedUntil: null }
        : { isActive: false }
    });

    await logAudit({
      action:
        !isActive && targetUser.role === Role.TECHNICIAN
          ? AuditAction.TECHNICIAN_DEACTIVATED
          : AuditAction.USER_UPDATED,
      entityType: "User",
      entityId: id,
      actorId: admin.id,
      description: `${isActive ? "Activated" : "Deactivated"} user`,
      metadata: {
        role: targetUser.role,
        userName: targetUser.name
      }
    });
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function deleteOfficeAction(id: string) {
  const admin = await requireAdminSession();

  const office = await db.office.findUnique({
    where: { id },
    select: { id: true, name: true }
  });

  if (!office) {
    throw new Error("Office not found.");
  }

  const submissionCount = await db.officeInventorySubmission.count({
    where: { officeId: id }
  });

  if (submissionCount > 0) {
    throw new Error("This office has inventory history and cannot be deleted. Archive it instead.");
  }

  await db.$transaction(async (tx) => {
    await tx.monthlyRequirementOverride.deleteMany({
      where: { officeId: id }
    });

    await tx.user.updateMany({
      where: { officeId: id },
      data: { officeId: null }
    });

    await tx.truck.updateMany({
      where: { officeId: id },
      data: { officeId: null }
    });

    await tx.office.delete({
      where: { id }
    });
  });

  await logAudit({
    action: AuditAction.OFFICE_ARCHIVED,
    entityType: "Office",
    entityId: id,
    actorId: admin.id,
    description: `Deleted office ${office.name}`,
    metadata: {
      officeName: office.name
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteUserAction(id: string) {
  const admin = await requireAdminSession();

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true }
  });

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.id === admin.id) {
    throw new Error("You cannot delete your own admin account while signed in.");
  }

  if (user.role === Role.ADMIN) {
    await assertAnotherActiveAdminExists(user.id);
  }

  await db.$transaction(async (tx) => {
    await tx.auditLog.updateMany({
      where: { actorId: user.id },
      data: { actorId: null }
    });

    await tx.fileUpload.updateMany({
      where: { uploadedById: user.id },
      data: { uploadedById: null }
    });

    await tx.user.delete({
      where: { id: user.id }
    });
  });

  await logAudit({
    action: AuditAction.USER_UPDATED,
    entityType: "User",
    entityId: user.id,
    actorId: admin.id,
    description: `Deleted user ${user.name}`,
    metadata: {
      role: user.role,
      userName: user.name
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true };
}

export async function setInventoryItemScopeAction(itemId: string, scope: InventoryScope) {
  await requireAdminSession();
  await db.inventoryItem.update({ where: { id: itemId }, data: { scope } });
  revalidatePath("/admin/settings");
  revalidatePath("/inventory");
  return { success: true };
}

export async function setMonthlyRequiredToggleAction(input: {
  month: number;
  year: number;
  targetType: RequirementTargetType;
  targetId: string;
  isRequired: boolean;
}) {
  const admin = await requireAdminSession();

  await setRequiredOverride({
    month: input.month,
    year: input.year,
    targetType: input.targetType,
    officeId: input.targetType === RequirementTargetType.OFFICE ? input.targetId : undefined,
    truckId: input.targetType === RequirementTargetType.TRUCK ? input.targetId : undefined,
    isRequired: input.isRequired,
    createdById: admin.id
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");

  return { success: true };
}
