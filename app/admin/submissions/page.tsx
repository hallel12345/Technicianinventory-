import { format } from "date-fns";
import Link from "next/link";

import { unlockSubmissionAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getCurrentMonthYear } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

function parseMonthYear(searchParams?: { month?: string; year?: string }) {
  const now = getCurrentMonthYear();
  const month = Number(searchParams?.month ?? now.month);
  const year = Number(searchParams?.year ?? now.year);

  return {
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.month,
    year: Number.isFinite(year) && year >= 2024 ? year : now.year
  };
}

export default async function AdminSubmissionsPage({
  searchParams
}: {
  searchParams?: Promise<{
    month?: string;
    year?: string;
    officeId?: string;
    truckId?: string;
    q?: string;
  }>;
}) {
  await requireAdmin();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { month, year } = parseMonthYear(resolvedSearchParams);
  const q = (resolvedSearchParams?.q ?? "").trim().toLowerCase();

  const [offices, trucks, officeSubmissions, truckSubmissions] = await Promise.all([
    db.office.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.truck.findMany({ where: { isActive: true }, orderBy: { licensePlate: "asc" } }),
    db.officeInventorySubmission.findMany({
      where: {
        month,
        year,
        officeId: resolvedSearchParams?.officeId || undefined
      },
      include: {
        office: true
      },
      orderBy: { submittedAt: "desc" }
    }),
    db.truckInventorySubmission.findMany({
      where: {
        month,
        year,
        truckId: resolvedSearchParams?.truckId || undefined
      },
      include: {
        truck: true
      },
      orderBy: { submittedAt: "desc" }
    })
  ]);

  const mergedRows = [
    ...officeSubmissions.map((submission) => ({
      type: "office" as const,
      id: submission.id,
      label: submission.office.name,
      technicianName: submission.technicianName,
      notes: submission.notes,
      submittedAt: submission.submittedAt
    })),
    ...truckSubmissions.map((submission) => ({
      type: "truck" as const,
      id: submission.id,
      label: `${submission.truck.name} (${submission.truck.licensePlate})`,
      technicianName: submission.technicianName,
      notes: submission.notes,
      submittedAt: submission.submittedAt
    }))
  ]
    .filter((row) => {
      if (!q) {
        return true;
      }

      return (
        row.label.toLowerCase().includes(q) ||
        row.technicianName.toLowerCase().includes(q) ||
        (row.notes ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Submission Management</CardTitle>
        <CardDescription className="mt-1">
          Search, filter, open, and unlock inventory submissions.
        </CardDescription>
        <form method="GET" className="mt-4 grid gap-3 sm:grid-cols-5">
          <input
            name="month"
            type="number"
            min={1}
            max={12}
            defaultValue={month}
            className="h-10 rounded-lg border border-gray-300 px-2"
          />
          <input
            name="year"
            type="number"
            min={2024}
            defaultValue={year}
            className="h-10 rounded-lg border border-gray-300 px-2"
          />
          <select
            name="officeId"
            defaultValue={resolvedSearchParams?.officeId ?? ""}
            className="h-10 rounded-lg border border-gray-300 px-2 text-sm"
          >
            <option value="">All offices</option>
            {offices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
          <select
            name="truckId"
            defaultValue={resolvedSearchParams?.truckId ?? ""}
            className="h-10 rounded-lg border border-gray-300 px-2 text-sm"
          >
            <option value="">All trucks</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.name} ({truck.licensePlate})
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={resolvedSearchParams?.q ?? ""}
            placeholder="Search"
            className="h-10 rounded-lg border border-gray-300 px-2"
          />
          <Button type="submit" className="sm:col-span-5">
            Apply Filters
          </Button>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-2">Type</th>
                <th className="py-2">Target</th>
                <th className="py-2">Technician</th>
                <th className="py-2">Submitted</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mergedRows.map((row) => {
                return (
                  <tr key={`${row.type}-${row.id}`} className="border-b border-gray-100">
                    <td className="py-2">
                      <Badge variant={row.type === "office" ? "default" : "success"}>{row.type}</Badge>
                    </td>
                    <td className="py-2 font-medium text-gray-800">{row.label}</td>
                    <td className="py-2">{row.technicianName}</td>
                    <td className="py-2 text-gray-600">{format(row.submittedAt, "MMM d, yyyy h:mm a")}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Link href={`/admin/submissions/${row.type}/${row.id}?month=${month}&year=${year}`}>
                          <Button size="sm" variant="secondary">
                            Open
                          </Button>
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await unlockSubmissionAction(row.type, row.id);
                          }}
                        >
                          <Button size="sm" variant="danger" type="submit">
                            Unlock
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
