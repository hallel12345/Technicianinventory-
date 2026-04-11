import { InventoryScope } from "@prisma/client";

import { requireTechnician } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getCurrentMonthYear, monthKey } from "@/lib/time";
import { InventoryWizard } from "@/components/tech/inventory-wizard";

export default async function InventoryPage() {
  const user = await requireTechnician();
  const { month, year } = getCurrentMonthYear();

  const [offices, trucks, officeItems, truckItems] = await Promise.all([
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
        officeId: true
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
    })
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card sm:p-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Start Monthly Inventory</h1>
        <p className="mt-2 text-sm text-gray-600">
          Period: {month}/{year}. Complete both office/shop and truck counts in one quick flow.
        </p>
      </div>

      <InventoryWizard
        offices={offices}
        trucks={trucks}
        officeItems={officeItems}
        truckItems={truckItems}
        technicianName={user.name ?? ""}
        draftKey={`inventory-draft-${user.id}-${monthKey(month, year)}`}
      />
    </div>
  );
}
