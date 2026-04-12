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

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

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
          <select
            name="month"
            defaultValue={month}
            className="h-10 w-32 rounded-lg border border-gray-300 px-2 text-sm"
          >
            {monthOptions.map((monthOption) => (
              <option key={monthOption.value} value={monthOption.value}>
                {monthOption.label}
              </option>
            ))}
          </select>
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
