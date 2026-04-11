import nodemailer from "nodemailer";
import { EmailLogType, EmailStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { buildMonthlySummaryEmail } from "@/lib/email/templates";
import { monthKey } from "@/lib/time";
import { getMonthlySnapshot } from "@/lib/services/monthly";

let transport: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transport) {
    return transport;
  }

  const env = getEnv();
  transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD
    }
  });

  return transport;
}

export async function queueAutoFinalEmailLog(
  tx: Prisma.TransactionClient,
  input: {
    month: number;
    year: number;
    monthlyCycleId: string;
    triggeredByUserId: string;
    triggeredBySubmissionId: string;
  }
) {
  const env = getEnv();
  const key = monthKey(input.month, input.year);

  try {
    const log = await tx.emailLog.create({
      data: {
        month: input.month,
        year: input.year,
        monthlyCycleId: input.monthlyCycleId,
        type: EmailLogType.AUTO_FINAL,
        status: EmailStatus.PENDING,
        toEmail: env.ADMIN_NOTIFICATION_EMAIL,
        subject: `Pure Pest Final Monthly Completion - ${key}`,
        htmlBody: "Pending render",
        textBody: "Pending render",
        autoKey: key,
        triggeredByUserId: input.triggeredByUserId,
        triggeredBySubmissionId: input.triggeredBySubmissionId
      }
    });

    return log;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
}

export async function sendEmailLog(emailLogId: string) {
  const log = await db.emailLog.findUnique({
    where: { id: emailLogId }
  });

  if (!log) {
    throw new Error("Email log not found.");
  }

  if (log.status === EmailStatus.SENT) {
    return { ok: true };
  }

  const snapshot = await getMonthlySnapshot(log.month, log.year);

  const content = buildMonthlySummaryEmail({
    month: log.month,
    year: log.year,
    percentComplete: snapshot.percentComplete,
    offices: snapshot.offices,
    trucks: snapshot.trucks,
    requiredOfficeCount: snapshot.requiredOfficeCount,
    requiredTruckCount: snapshot.requiredTruckCount,
    completedOfficeCount: snapshot.completedOfficeCount,
    completedTruckCount: snapshot.completedTruckCount,
    isFinal: log.type === EmailLogType.AUTO_FINAL,
    trucksDueForRegistrationThisMonth: snapshot.trucksDueForRegistrationThisMonth,
    expiredRegistrationTrucks: snapshot.expiredRegistrationTrucks,
    trucksMissingRegistrationData: snapshot.trucksMissingRegistrationData
  });

  const subject =
    log.type === EmailLogType.AUTO_FINAL
      ? `Pure Pest Final Monthly Completion - ${content.monthLabel}`
      : `Pure Pest Monthly Summary (Manual Resend) - ${content.monthLabel}`;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: getEnv().GMAIL_USER,
      to: log.toEmail,
      subject,
      html: content.html,
      text: content.text
    });

    await db.$transaction(async (tx) => {
      await tx.emailLog.update({
        where: { id: log.id },
        data: {
          subject,
          htmlBody: content.html,
          textBody: content.text,
          status: EmailStatus.SENT,
          sentAt: new Date(),
          errorMessage: null
        }
      });

      if (log.type === EmailLogType.AUTO_FINAL) {
        await tx.monthlyCycle.updateMany({
          where: { id: log.monthlyCycleId },
          data: {
            autoEmailSent: true,
            autoEmailSentAt: new Date()
          }
        });
      }
    });

    return { ok: true };
  } catch (error) {
    await db.emailLog.update({
      where: { id: log.id },
      data: {
        subject,
        htmlBody: content.html,
        textBody: content.text,
        status: EmailStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Unknown email failure"
      }
    });

    return { ok: false, error: error instanceof Error ? error.message : "Unknown email failure" };
  }
}

export async function createAndSendManualResend(input: {
  month: number;
  year: number;
  actorId: string;
}) {
  const env = getEnv();

  const cycle = await db.monthlyCycle.upsert({
    where: { month_year: { month: input.month, year: input.year } },
    update: {},
    create: { month: input.month, year: input.year }
  });

  const log = await db.emailLog.create({
    data: {
      month: input.month,
      year: input.year,
      monthlyCycleId: cycle.id,
      type: EmailLogType.MANUAL_RESEND,
      status: EmailStatus.PENDING,
      toEmail: env.ADMIN_NOTIFICATION_EMAIL,
      subject: `Manual resend for ${monthKey(input.month, input.year)}`,
      htmlBody: "Pending render",
      textBody: "Pending render",
      triggeredByUserId: input.actorId
    }
  });

  return sendEmailLog(log.id);
}
