import { InventoryScope } from "@prisma/client";

import { requireTechnician } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getCurrentMonthYear, monthKey } from "@/lib/time";
import { InventoryWizard } from "@/components/tech/inventory-wizard";

export default async function InventoryPage() {
  const user = await requireTechnician();
  const { month, year } = getCurrentMonthYear();

  const [offices, trucks, officeItems, truckItems, officeSubmissions, truckSubmissions] = await Promise.all([
    db.office.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    db.truck.findMany({
      where: { isActive: true },
      orderBy: [{ office: { name: "asc" } }, { licensePlate: "asc" }],
      select: {
        id: true,
        name: true,
        licensePlate: true,
        officeId: true,
        registrationExpirationMonth: true,
        registrationExpirationYear: true
      }
    }),
    db.inventoryItem.findMany({
      where: {
        isActive: true,
        scope: { in: [InventoryScope.OFFICE, InventoryScope.BOTH] }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true }
    }),
    db.inventoryItem.findMany({
      where: {
        isActive: true,
        scope: { in: [InventoryScope.TRUCK, InventoryScope.BOTH] }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true }
    }),
    db.officeInventorySubmission.findMany({
      where: { month, year },
      select: {
        officeId: true,
        technicianName: true,
        submittedAt: true
      }
    }),
    db.truckInventorySubmission.findMany({
      where: { month, year },
      select: { truckId: true }
    })
  ]);

  const officesWithSubmission = new Map(officeSubmissions.map((submission) => [submission.officeId, submission]));
  const trucksWithSubmission = new Set(truckSubmissions.map((submission) => submission.truckId));

  const officeOptions = offices.map((office) => {
    const existing = officesWithSubmission.get(office.id);
    return {
      ...office,
      hasCurrentSubmission: Boolean(existing),
      lastSubmittedAt: existing?.submittedAt.toISOString() ?? null,
      lastSubmittedBy: existing?.technicianName ?? null
    };
  });

  const truckOptions = trucks.map((truck) => ({
    ...truck,
    hasCurrentSubmission: trucksWithSubmission.has(truck.id)
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card sm:p-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Start Monthly Inventory</h1>
        <p className="mt-2 text-sm text-gray-600">
          Period: {month}/{year}. Complete truck counts, and update office/shop counts only when needed.
        </p>
      </div>

      <InventoryWizard
        offices={officeOptions}
        trucks={truckOptions}
        officeItems={officeItems}
        truckItems={truckItems}
        technicianName={user.name ?? ""}
        draftKey={`inventory-draft-${user.id}-${monthKey(month, year)}`}
      />
    </div>
  );
}
