import { getRequiredTargetsForMonth } from "@/lib/services/monthly";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getCurrentMonthYear } from "@/lib/time";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SettingsClient } from "@/components/admin/settings-client";

function parseMonthYear(searchParams?: { month?: string; year?: string }) {
  const now = getCurrentMonthYear();
  const month = Number(searchParams?.month ?? now.month);
  const year = Number(searchParams?.year ?? now.year);

  return {
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.month,
    year: Number.isFinite(year) && year >= 2024 ? year : now.year
  };
}

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string; year?: string }>;
}) {
  await requireAdmin();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { month, year } = parseMonthYear(resolvedSearchParams);

  const [offices, trucks, items, users, requiredTargets] = await Promise.all([
    db.office.findMany({ orderBy: { name: "asc" } }),
    db.truck.findMany({ orderBy: [{ name: "asc" }, { licensePlate: "asc" }] }),
    db.inventoryItem.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }),
    getRequiredTargetsForMonth(db, month, year)
  ]);

  const officeRequired = Object.fromEntries(
    requiredTargets.officeTargets.map((office) => [office.id, office.required])
  );
  const truckRequired = Object.fromEntries(
    requiredTargets.truckTargets.map((truck) => [truck.id, truck.required])
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Admin Settings</CardTitle>
        <CardDescription className="mt-1">
          Manage offices, trucks (including registration expiration), inventory items, users, and monthly required overrides.
        </CardDescription>
      </Card>

      <form method="GET" className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-card">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Month</label>
          <input
            type="number"
            name="month"
            min={1}
            max={12}
            defaultValue={month}
            className="h-10 w-20 rounded-lg border border-gray-300 px-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Year</label>
          <input
            type="number"
            name="year"
            min={2024}
            defaultValue={year}
            className="h-10 w-24 rounded-lg border border-gray-300 px-2"
          />
        </div>
        <button className="h-10 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-brand-dark" type="submit">
          Load Month
        </button>
      </form>

      <SettingsClient
        month={month}
        year={year}
        offices={offices}
        trucks={trucks}
        items={items}
        users={users}
        officeRequired={officeRequired}
        truckRequired={truckRequired}
      />
    </div>
  );
}
