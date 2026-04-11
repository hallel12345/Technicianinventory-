import { format } from "date-fns";

import { requireTechnician } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default async function MySubmissionsPage() {
  const user = await requireTechnician();

  const [officeSubmissions, truckSubmissions] = await Promise.all([
    db.officeInventorySubmission.findMany({
      where: { createdById: user.id },
      orderBy: { submittedAt: "desc" },
      take: 20,
      include: { office: true }
    }),
    db.truckInventorySubmission.findMany({
      where: { createdById: user.id },
      orderBy: { submittedAt: "desc" },
      take: 20,
      include: { truck: true }
    })
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>My Recent Confirmations</CardTitle>
        <CardDescription className="mt-1">
          Quick view of your latest office and truck inventory submissions.
        </CardDescription>
      </Card>

      <Card>
        <CardTitle>Office / Shop Submissions</CardTitle>
        <div className="mt-4 space-y-3">
          {officeSubmissions.length ? (
            officeSubmissions.map((submission) => (
              <div key={submission.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>{submission.office.name}</strong>
                  <Badge variant="success">{submission.month}/{submission.year}</Badge>
                </div>
                <p className="mt-1 text-gray-600">
                  Submitted {format(submission.submittedAt, "MMM d, yyyy h:mm a")}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">No office submissions yet.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Truck Submissions</CardTitle>
        <div className="mt-4 space-y-3">
          {truckSubmissions.length ? (
            truckSubmissions.map((submission) => (
              <div key={submission.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>
                    {submission.truck.name} ({submission.truck.licensePlate})
                  </strong>
                  <Badge variant="success">{submission.month}/{submission.year}</Badge>
                </div>
                <p className="mt-1 text-gray-600">
                  Submitted {format(submission.submittedAt, "MMM d, yyyy h:mm a")}
                </p>
                <p className="mt-1 text-gray-600">
                  Odometer: {submission.odometerMiles} mi | Oil change:{" "}
                  {submission.oilChangeCompleted ? "completed" : "not marked"}
                </p>
                <p className="mt-1 text-gray-600">
                  Last oil change date:{" "}
                  {submission.lastOilChangeDate ? format(submission.lastOilChangeDate, "MMM d, yyyy") : "-"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">No truck submissions yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
