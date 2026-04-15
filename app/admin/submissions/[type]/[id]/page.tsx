import { notFound } from "next/navigation";

import { unlockSubmissionAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { SubmissionEditForm } from "@/components/admin/submission-edit-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default async function AdminSubmissionDetailPage({
  params
}: {
  params: Promise<{ type: "office" | "truck"; id: string }>;
}) {
  await requireAdmin();
  const resolvedParams = await params;

  if (resolvedParams.type !== "office" && resolvedParams.type !== "truck") {
    notFound();
  }

  if (resolvedParams.type === "office") {
    const submission = await db.officeInventorySubmission.findUnique({
      where: { id: resolvedParams.id },
      include: {
        office: true,
        counts: {
          include: { inventoryItem: true },
          orderBy: { inventoryItem: { sortOrder: "asc" } }
        }
      }
    });

    if (!submission) {
      notFound();
    }

    return (
      <div className="space-y-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Office Submission: {submission.office.name}</CardTitle>
              <CardDescription className="mt-1">
                {submission.month}/{submission.year} - Edit, then save.
              </CardDescription>
            </div>
            <form
              action={async () => {
                "use server";
                await unlockSubmissionAction("office", submission.id);
              }}
            >
              <Button variant="danger">Unlock / Delete</Button>
            </form>
          </div>
        </Card>

        <Card>
          <SubmissionEditForm
            submissionType="office"
            submissionId={submission.id}
            technicianName={submission.technicianName}
            notes={submission.notes ?? ""}
            problemsReported={submission.problemsReported ?? ""}
            missingDamagedNotes={submission.missingDamagedNotes ?? ""}
            counts={submission.counts.map((count) => ({
              itemId: count.inventoryItemId,
              itemName: count.inventoryItem.name,
              quantity: count.quantity
            }))}
          />
        </Card>
      </div>
    );
  }

  const submission = await db.truckInventorySubmission.findUnique({
    where: { id: resolvedParams.id },
    include: {
      truck: true,
      counts: {
        include: { inventoryItem: true },
        orderBy: { inventoryItem: { sortOrder: "asc" } }
      }
    }
  });

  if (!submission) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>
              Truck Submission: {submission.truck.name} ({submission.truck.licensePlate})
            </CardTitle>
            <CardDescription className="mt-1">
              {submission.month}/{submission.year} - Edit, then save.
            </CardDescription>
          </div>
          <form
            action={async () => {
              "use server";
              await unlockSubmissionAction("truck", submission.id);
            }}
          >
            <Button variant="danger">Unlock / Delete</Button>
          </form>
        </div>
      </Card>

      <Card>
        <SubmissionEditForm
          submissionType="truck"
          submissionId={submission.id}
          technicianName={submission.technicianName}
          odometerMiles={submission.odometerMiles}
          lastOilChangeMiles={submission.truck.lastOilChangeMiles ?? undefined}
          oilChangeCompleted={submission.oilChangeCompleted}
          maintenanceCheckCompleted={submission.maintenanceCheckCompleted}
          lastOilChangeDate={submission.lastOilChangeDate ? submission.lastOilChangeDate.toISOString().slice(0, 10) : ""}
          maintenanceNotes={submission.maintenanceNotes ?? ""}
          notes={submission.notes ?? ""}
          problemsReported={submission.problemsReported ?? ""}
          missingDamagedNotes={submission.missingDamagedNotes ?? ""}
          counts={submission.counts.map((count) => ({
            itemId: count.inventoryItemId,
            itemName: count.inventoryItem.name,
            quantity: count.quantity
          }))}
        />
      </Card>
    </div>
  );
}
