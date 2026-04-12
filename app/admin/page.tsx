import { format } from "date-fns";
import Link from "next/link";

import { resendMonthlySummaryAction, setMonthLockAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getMonthlySnapshot } from "@/lib/services/monthly";
import { formatMonthYear, getCurrentMonthYear } from "@/lib/time";
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

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: format(new Date(2024, index, 1), "MMMM")
}));

function oilProgressBarClass(state?: "green" | "yellow" | "red") {
  if (state === "red") {
    return "bg-red-500";
  }
  if (state === "yellow") {
    return "bg-amber-400";
  }
  return "bg-emerald-500";
}

function registrationVariant(status?: string) {
  if (status === "EXPIRED") {
    return "danger" as const;
  }
  if (status === "DUE_THIS_MONTH") {
    return "warning" as const;
  }
  if (status === "UP_TO_DATE") {
    return "success" as const;
  }
  return "default" as const;
}

function registrationLabel(status?: string) {
  if (status === "EXPIRED") {
    return "Expired";
  }
  if (status === "DUE_THIS_MONTH") {
    return "Due This Month";
  }
  if (status === "UP_TO_DATE") {
    return "Up to Date";
  }
  return "Missing Data";
}

function registrationExpirationLabel(month: number | null | undefined, year: number | null | undefined) {
  if (!month || !year) {
    return "-";
  }

  return `${formatMonthYear(month, year)} (${month}/${year})`;
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string; year?: string }>;
}) {
  await requireAdmin();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { month, year } = parseMonthYear(resolvedSearchParams);

  const [snapshot, autoEmailLog] = await Promise.all([
    getMonthlySnapshot(month, year),
    db.emailLog.findFirst({
      where: { month, year, type: "AUTO_FINAL", status: "SENT" },
      orderBy: { sentAt: "desc" }
    })
  ]);

  async function toggleMonthLock() {
    "use server";
    await setMonthLockAction(month, year, !(snapshot.cycle?.isLocked ?? false));
  }

  async function manualResend() {
    "use server";
    await resendMonthlySummaryAction(month, year);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Monthly Completion Dashboard</CardTitle>
            <CardDescription className="mt-1">
              Track required office and truck inventory submissions for {month}/{year}.
            </CardDescription>
          </div>
          <form className="flex items-end gap-2" method="GET">
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
                name="year"
                type="number"
                min={2024}
                defaultValue={year}
                className="h-10 w-24 rounded-lg border border-gray-300 px-2"
              />
            </div>
            <Button type="submit" size="sm">
              Load
            </Button>
          </form>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardDescription>Percent Complete</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.percentComplete}%</CardTitle>
        </Card>
        <Card>
          <CardDescription>Office Completion</CardDescription>
          <CardTitle className="mt-1 text-2xl">
            {snapshot.completedOfficeCount}/{snapshot.requiredOfficeCount}
          </CardTitle>
        </Card>
        <Card>
          <CardDescription>Truck Completion</CardDescription>
          <CardTitle className="mt-1 text-2xl">
            {snapshot.completedTruckCount}/{snapshot.requiredTruckCount}
          </CardTitle>
        </Card>
        <Card>
          <CardDescription>Month Lock</CardDescription>
          <div className="mt-2">
            <Badge variant={snapshot.cycle?.isLocked ? "warning" : "success"}>
              {snapshot.cycle?.isLocked ? "Locked" : "Unlocked"}
            </Badge>
          </div>
          <form action={toggleMonthLock} className="mt-3">
            <Button size="sm" variant="secondary" className="w-full">
              {snapshot.cycle?.isLocked ? "Unlock Month" : "Lock Month"}
            </Button>
          </form>
        </Card>
        <Card>
          <CardDescription>Tracked Truck Miles</CardDescription>
          <CardTitle className="mt-1 text-2xl">
            {snapshot.trucks.reduce((sum, truck) => sum + (truck.milesDrivenSinceLast ?? 0), 0)}
          </CardTitle>
          <p className="mt-2 text-xs text-gray-600">
            Sum of miles driven since prior submission across trucks this month.
          </p>
        </Card>
        <Card>
          <CardDescription>Registrations Due This Month</CardDescription>
          <CardTitle className="mt-1 text-2xl">{snapshot.trucksDueForRegistrationThisMonth.length}</CardTitle>
          <p className="mt-2 text-xs text-gray-600">Renew these before next month.</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Email Status</CardTitle>
            <CardDescription className="mt-1">
              Auto-send happens once when the final required submission is completed.
            </CardDescription>
          </div>
          <form action={manualResend}>
            <Button variant="secondary">Manual Resend</Button>
          </form>
        </div>
        <div className="mt-3 text-sm text-gray-700">
          {autoEmailLog?.sentAt ? (
            <>
              <Badge variant="success">Auto email sent</Badge>
              <p className="mt-2">Sent at {format(autoEmailLog.sentAt, "MMM d, yyyy h:mm a")}</p>
            </>
          ) : (
            <>
              <Badge variant="warning">Auto email not sent yet</Badge>
              <p className="mt-2">Waiting for all required submissions.</p>
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Office Completion Cards</CardTitle>
          <div className="mt-4 space-y-3">
            {snapshot.offices.map((office) => (
              <div key={office.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <strong>{office.name}</strong>
                  <Badge
                    variant={!office.required ? "default" : office.submitted ? "success" : "danger"}
                  >
                    {!office.required ? "Not required" : office.submitted ? "Complete" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-1 text-gray-600">
                  {office.submitted
                    ? `${office.technicianName ?? "Unknown"} - ${
                        office.submittedAt ? format(office.submittedAt, "MMM d h:mm a") : "No timestamp"
                      }`
                    : "Not submitted"}
                </p>
                {office.submissionId ? (
                  <Link
                    href={`/admin/submissions/office/${office.submissionId}?month=${month}&year=${year}`}
                    className="mt-2 inline-block text-sm font-medium text-brand-dark underline"
                  >
                    Open submission
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Truck Completion Cards</CardTitle>
          <div className="mt-4 space-y-3">
            {snapshot.trucks.map((truck) => (
              <div key={truck.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <strong>{truck.name}</strong>
                  <Badge
                    variant={!truck.required ? "default" : truck.submitted ? "success" : "danger"}
                  >
                    {!truck.required ? "Not required" : truck.submitted ? "Complete" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-1 text-gray-600">
                  {truck.submitted
                    ? `${truck.technicianName ?? "Unknown"} - ${
                        truck.submittedAt ? format(truck.submittedAt, "MMM d h:mm a") : "No timestamp"
                      }`
                    : "Not submitted"}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-700">
                  <p>
                    Registration expires:{" "}
                    {registrationExpirationLabel(truck.registrationExpirationMonth, truck.registrationExpirationYear)}
                  </p>
                  <Badge variant={registrationVariant(truck.registrationStatus)}>
                    {registrationLabel(truck.registrationStatus)}
                  </Badge>
                </div>
                {truck.submitted ? (
                  <div className="mt-2 space-y-1 text-xs text-gray-700">
                    <p>Odometer: {truck.odometerMiles ?? 0} miles</p>
                    <p>
                      Miles since last:{" "}
                      {truck.milesDrivenSinceLast !== null && truck.milesDrivenSinceLast !== undefined
                        ? `${truck.milesDrivenSinceLast} miles`
                        : "N/A"}
                    </p>
                    <div className="mt-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="font-medium text-gray-800">Oil Change Progress</p>
                        <p>
                          {truck.oilChangeProgressPercent ?? 0}% ({truck.milesIntoOilCycle ?? 0}/5000 mi)
                        </p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full transition-all ${oilProgressBarClass(truck.oilChangeProgressState)}`}
                          style={{ width: `${truck.oilChangeProgressPercent ?? 0}%` }}
                        />
                      </div>
                      <p className="mt-1">
                        Miles until next oil change: {truck.milesUntilOilChange ?? "N/A"}
                      </p>
                    </div>
                    <p>
                      Last oil change date (manual):{" "}
                      {truck.lastOilChangeDate ? format(truck.lastOilChangeDate, "MMM d, yyyy") : "-"}
                    </p>
                    <p>Maintenance check completed: {truck.maintenanceCheckCompleted ? "Yes" : "No"}</p>
                    <p>Maintenance notes: {truck.maintenanceNotes || "-"}</p>
                    {truck.oilChangeDue ? <p className="font-semibold text-red-700">Oil change due soon.</p> : null}
                  </div>
                ) : null}
                {truck.submissionId ? (
                  <Link
                    href={`/admin/submissions/truck/${truck.submissionId}?month=${month}&year=${year}`}
                    className="mt-2 inline-block text-sm font-medium text-brand-dark underline"
                  >
                    Open submission
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Registration Alerts</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Due This Month</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {snapshot.trucksDueForRegistrationThisMonth.length ? (
                snapshot.trucksDueForRegistrationThisMonth.map((truck) => <li key={truck.id}>- {truck.name}</li>)
              ) : (
                <li>None.</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Expired</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {snapshot.expiredRegistrationTrucks.length ? (
                snapshot.expiredRegistrationTrucks.map((truck) => <li key={truck.id}>- {truck.name}</li>)
              ) : (
                <li>None.</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Missing Data</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {snapshot.trucksMissingRegistrationData.length ? (
                snapshot.trucksMissingRegistrationData.map((truck) => <li key={truck.id}>- {truck.name}</li>)
              ) : (
                <li>None.</li>
              )}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Missing Submissions</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Offices</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {snapshot.missingOffices.length ? (
                snapshot.missingOffices.map((office) => <li key={office.id}>- {office.name}</li>)
              ) : (
                <li>All required offices complete.</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Trucks</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {snapshot.missingTrucks.length ? (
                snapshot.missingTrucks.map((truck) => <li key={truck.id}>- {truck.name}</li>)
              ) : (
                <li>All required trucks complete.</li>
              )}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Exports</CardTitle>
            <CardDescription className="mt-1">Download CSV reports for this month.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/admin/export?month=${month}&year=${year}&type=all`}>
              <Button variant="secondary" size="sm">
                Export All CSV
              </Button>
            </a>
            <a href={`/api/admin/export?month=${month}&year=${year}&type=office`}>
              <Button variant="secondary" size="sm">
                Export Office CSV
              </Button>
            </a>
            <a href={`/api/admin/export?month=${month}&year=${year}&type=truck`}>
              <Button variant="secondary" size="sm">
                Export Truck CSV
              </Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
