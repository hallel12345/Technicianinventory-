"use server";

import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { createTechnicianSubmission, SubmissionError } from "@/lib/services/submission";
import { technicianSubmissionSchema } from "@/lib/schemas/submission";

export type TechnicianSubmissionState = {
  success?: boolean;
  submissionId?: string;
  error?: string;
};

export async function submitTechnicianInventoryAction(
  rawInput: unknown
): Promise<TechnicianSubmissionState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.TECHNICIAN) {
    return { error: "Unauthorized" };
  }

  const parsed = technicianSubmissionSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid submission.";
    return { error: firstError };
  }

  try {
    const result = await createTechnicianSubmission(parsed.data, session.user.id);
    return {
      success: true,
      submissionId: result.truckSubmissionId
    };
  } catch (error) {
    if (error instanceof SubmissionError) {
      return { error: error.message };
    }

    return {
      error: error instanceof Error ? error.message : "Failed to submit inventory."
    };
  }
}
