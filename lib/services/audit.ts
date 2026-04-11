import { AuditAction, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function logAudit(input: {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  description: string;
  actorId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
      actorId: input.actorId,
      metadata: input.metadata
    }
  });
}
