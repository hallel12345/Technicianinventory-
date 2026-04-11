"use client";

import { InventoryScope, RequirementTargetType, Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  archiveEntityAction,
  deleteOfficeAction,
  saveInventoryItemAction,
  saveOfficeAction,
  saveTruckAction,
  saveUserAction,
  setMonthlyRequiredToggleAction
} from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Office = {
  id: string;
  name: string;
  isActive: boolean;
  requiredByDefault: boolean;
};

type Truck = {
  id: string;
  name: string;
  licensePlate: string;
  registrationExpirationMonth: number | null;
  registrationExpirationYear: number | null;
  officeId: string | null;
  isActive: boolean;
  requiredByDefault: boolean;
};

type InventoryItem = {
  id: string;
  name: string;
  scope: InventoryScope;
  isActive: boolean;
  sortOrder: number;
};

type User = {
  id: string;
  name: string;
  role: Role;
  email: string | null;
  userCode: string | null;
  officeId: string | null;
  isActive: boolean;
};

function boolText(value: boolean) {
  return value ? "true" : "false";
}

function parseNullableNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function humanizeActionError(actionError: unknown) {
  const rawMessage = actionError instanceof Error ? actionError.message : "Action failed.";

  if (rawMessage.includes("Unique constraint failed")) {
    return "That value already exists. Try a different name/code.";
  }
  if (rawMessage.includes("Foreign key constraint failed")) {
    return "This record is linked to other data and cannot be changed that way.";
  }
  if (rawMessage.includes("Record to update not found") || rawMessage.includes("Record to delete does not exist")) {
    return "That record no longer exists. Refresh and try again.";
  }

  return rawMessage;
}

export function SettingsClient({
  month,
  year,
  offices,
  trucks,
  items,
  users,
  officeRequired,
  truckRequired
}: {
  month: number;
  year: number;
  offices: Office[];
  trucks: Truck[];
  items: InventoryItem[];
  users: User[];
  officeRequired: Record<string, boolean>;
  truckRequired: Record<string, boolean>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runServerAction<T>(fn: () => Promise<T>, successMessage: string) {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        await fn();
        setFeedback(successMessage);
        router.refresh();
      } catch (actionError) {
        setError(humanizeActionError(actionError));
      }
    });
  }

  return (
    <div className="space-y-4">
      {feedback ? <p className="text-sm text-green-700">{feedback}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardTitle>Office Settings</CardTitle>
        <div className="mt-3 space-y-3">
          {offices.map((office) => (
            <form
              key={office.id}
              className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-6"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                runServerAction(
                  () =>
                    saveOfficeAction({
                      id: office.id,
                      name: String(form.get("name") ?? ""),
                      isActive: String(form.get("isActive") ?? "true") === "true",
                      requiredByDefault: String(form.get("requiredByDefault") ?? "true") === "true"
                    }),
                  `Saved office ${office.name}.`
                );
              }}
            >
              <Input name="name" defaultValue={office.name} />
              <Select name="isActive" defaultValue={boolText(office.isActive)}>
                <option value="true">Active</option>
                <option value="false">Archived</option>
              </Select>
              <Select name="requiredByDefault" defaultValue={boolText(office.requiredByDefault)}>
                <option value="true">Required by default</option>
                <option value="false">Not required by default</option>
              </Select>
              <Button type="submit" variant="secondary" disabled={isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant={office.isActive ? "danger" : "secondary"}
                onClick={() =>
                  runServerAction(
                    () => archiveEntityAction("office", office.id, !office.isActive),
                    `${office.isActive ? "Archived" : "Activated"} office ${office.name}.`
                  )
                }
              >
                {office.isActive ? "Archive" : "Activate"}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (!window.confirm(`Delete office ${office.name}? This cannot be undone.`)) {
                    return;
                  }

                  runServerAction(() => deleteOfficeAction(office.id), `Deleted office ${office.name}.`);
                }}
              >
                Delete
              </Button>
            </form>
          ))}

          <form
            className="grid gap-2 rounded-xl border border-dashed border-gray-300 p-3 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);

              runServerAction(
                () =>
                  saveOfficeAction({
                    name: String(form.get("name") ?? ""),
                    isActive: true,
                    requiredByDefault: true
                  }),
                "Created office."
              );
            }}
          >
            <Input name="name" placeholder="New office name" required />
            <Button type="submit" className="sm:col-span-3" disabled={isPending}>
              Add Office
            </Button>
          </form>
        </div>
      </Card>

      <Card>
        <CardTitle>Truck Settings</CardTitle>
        <div className="mt-3 space-y-3">
          {trucks.map((truck) => (
            <form
              key={truck.id}
              className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-9"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);

                runServerAction(
                  () =>
                    saveTruckAction({
                      id: truck.id,
                      name: String(form.get("name") ?? ""),
                      licensePlate: String(form.get("licensePlate") ?? ""),
                      registrationExpirationMonth: parseNullableNumber(form.get("registrationExpirationMonth")),
                      registrationExpirationYear: parseNullableNumber(form.get("registrationExpirationYear")),
                      officeId: (String(form.get("officeId") ?? "") || null) as string | null,
                      isActive: String(form.get("isActive") ?? "true") === "true",
                      requiredByDefault: String(form.get("requiredByDefault") ?? "true") === "true"
                    }),
                  `Saved truck ${truck.name}.`
                );
              }}
            >
              <Input name="name" defaultValue={truck.name} />
              <Input name="licensePlate" defaultValue={truck.licensePlate} />
              <Input
                name="registrationExpirationMonth"
                type="number"
                min={1}
                max={12}
                placeholder="Reg month"
                defaultValue={truck.registrationExpirationMonth ?? ""}
              />
              <Input
                name="registrationExpirationYear"
                type="number"
                min={2020}
                max={2100}
                placeholder="Reg year"
                defaultValue={truck.registrationExpirationYear ?? ""}
              />
              <Select name="officeId" defaultValue={truck.officeId ?? ""}>
                <option value="">Unassigned</option>
                {offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </Select>
              <Select name="isActive" defaultValue={boolText(truck.isActive)}>
                <option value="true">Active</option>
                <option value="false">Archived</option>
              </Select>
              <Select name="requiredByDefault" defaultValue={boolText(truck.requiredByDefault)}>
                <option value="true">Required by default</option>
                <option value="false">Not required by default</option>
              </Select>
              <Button type="submit" variant="secondary" disabled={isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant={truck.isActive ? "danger" : "secondary"}
                onClick={() =>
                  runServerAction(
                    () => archiveEntityAction("truck", truck.id, !truck.isActive),
                    `${truck.isActive ? "Archived" : "Activated"} truck ${truck.name}.`
                  )
                }
              >
                {truck.isActive ? "Archive" : "Activate"}
              </Button>
            </form>
          ))}

          <form
            className="grid gap-2 rounded-xl border border-dashed border-gray-300 p-3 sm:grid-cols-6"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);

              runServerAction(
                () =>
                  saveTruckAction({
                    name: String(form.get("name") ?? ""),
                    licensePlate: String(form.get("licensePlate") ?? ""),
                    registrationExpirationMonth: parseNullableNumber(form.get("registrationExpirationMonth")),
                    registrationExpirationYear: parseNullableNumber(form.get("registrationExpirationYear")),
                    officeId: (String(form.get("officeId") ?? "") || null) as string | null,
                    isActive: true,
                    requiredByDefault: true
                  }),
                "Created truck."
              );
            }}
          >
            <Input name="name" placeholder="Truck name" required />
            <Input name="licensePlate" placeholder="License plate" required />
            <Input name="registrationExpirationMonth" type="number" min={1} max={12} placeholder="Reg month" />
            <Input name="registrationExpirationYear" type="number" min={2020} max={2100} placeholder="Reg year" />
            <Select name="officeId" defaultValue="">
              <option value="">Assign office (optional)</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={isPending}>
              Add Truck
            </Button>
          </form>
        </div>
      </Card>

      <Card>
        <CardTitle>Inventory Items</CardTitle>
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <form
              key={item.id}
              className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-6"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);

                runServerAction(
                  () =>
                    saveInventoryItemAction({
                      id: item.id,
                      name: String(form.get("name") ?? ""),
                      scope: String(form.get("scope") ?? InventoryScope.BOTH),
                      isActive: String(form.get("isActive") ?? "true") === "true",
                      sortOrder: Number(form.get("sortOrder") ?? item.sortOrder)
                    }),
                  `Saved item ${item.name}.`
                );
              }}
            >
              <Input name="name" defaultValue={item.name} />
              <Select name="scope" defaultValue={item.scope}>
                <option value="OFFICE">Office only</option>
                <option value="TRUCK">Truck only</option>
                <option value="BOTH">Both</option>
              </Select>
              <Input name="sortOrder" type="number" defaultValue={item.sortOrder} />
              <Select name="isActive" defaultValue={boolText(item.isActive)}>
                <option value="true">Active</option>
                <option value="false">Archived</option>
              </Select>
              <Button type="submit" variant="secondary" disabled={isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant={item.isActive ? "danger" : "secondary"}
                onClick={() =>
                  runServerAction(
                    () => archiveEntityAction("inventoryItem", item.id, !item.isActive),
                    `${item.isActive ? "Archived" : "Activated"} item ${item.name}.`
                  )
                }
              >
                {item.isActive ? "Archive" : "Activate"}
              </Button>
            </form>
          ))}

          <form
            className="grid gap-2 rounded-xl border border-dashed border-gray-300 p-3 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);

              runServerAction(
                () =>
                  saveInventoryItemAction({
                    name: String(form.get("name") ?? ""),
                    scope: String(form.get("scope") ?? InventoryScope.BOTH),
                    sortOrder: Number(form.get("sortOrder") ?? 0),
                    isActive: true
                  }),
                "Created inventory item."
              );
            }}
          >
            <Input name="name" placeholder="Item name" required />
            <Select name="scope" defaultValue="BOTH">
              <option value="OFFICE">Office only</option>
              <option value="TRUCK">Truck only</option>
              <option value="BOTH">Both</option>
            </Select>
            <Input name="sortOrder" type="number" defaultValue={0} />
            <Button type="submit" className="sm:col-span-3" disabled={isPending}>
              Add Item
            </Button>
          </form>
        </div>
      </Card>

      <Card>
        <CardTitle>User Management</CardTitle>
        <CardDescription className="mt-1">Manage technician and admin users.</CardDescription>
        <div className="mt-3 space-y-3">
          {users.map((user) => (
            <form
              key={user.id}
              className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-7"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);

                runServerAction(
                  () =>
                    saveUserAction({
                      id: user.id,
                      name: String(form.get("name") ?? ""),
                      role: String(form.get("role") ?? user.role),
                      email: String(form.get("email") ?? ""),
                      userCode: String(form.get("userCode") ?? ""),
                      officeId: (String(form.get("officeId") ?? "") || null) as string | null,
                      password: String(form.get("password") ?? "") || undefined,
                      pin: String(form.get("pin") ?? "") || undefined,
                      isActive: String(form.get("isActive") ?? "true") === "true"
                    }),
                  `Saved user ${user.name}.`
                );
              }}
            >
              <Input name="name" defaultValue={user.name} />
              <Select name="role" defaultValue={user.role}>
                <option value="TECHNICIAN">Technician</option>
                <option value="ADMIN">Admin</option>
              </Select>
              <Input name="email" defaultValue={user.email ?? ""} placeholder="Email" />
              <Input name="userCode" defaultValue={user.userCode ?? ""} placeholder="User code" />
              <Select name="officeId" defaultValue={user.officeId ?? ""}>
                <option value="">No office</option>
                {offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </Select>
              <Select name="isActive" defaultValue={boolText(user.isActive)}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
              <Button type="submit" variant="secondary" disabled={isPending}>
                Save
              </Button>
              <Input name="password" placeholder="New password (admins)" />
              <Input name="pin" placeholder="New 4-digit PIN" />
              <Button
                type="button"
                variant={user.isActive ? "danger" : "secondary"}
                onClick={() =>
                  runServerAction(
                    () => archiveEntityAction("user", user.id, !user.isActive),
                    `${user.isActive ? "Deactivated" : "Activated"} user ${user.name}.`
                  )
                }
              >
                {user.isActive ? "Deactivate" : "Activate"}
              </Button>
            </form>
          ))}

          <form
            className="grid gap-2 rounded-xl border border-dashed border-gray-300 p-3 sm:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const role = String(form.get("role") ?? Role.TECHNICIAN);

              runServerAction(
                () =>
                  saveUserAction({
                    name: String(form.get("name") ?? ""),
                    role,
                    email: String(form.get("email") ?? ""),
                    userCode: String(form.get("userCode") ?? ""),
                    officeId: (String(form.get("officeId") ?? "") || null) as string | null,
                    password: String(form.get("password") ?? "") || undefined,
                    pin: String(form.get("pin") ?? "") || undefined,
                    isActive: true
                  }),
                "Created user."
              );
            }}
          >
            <Input name="name" placeholder="Full name" required />
            <Select name="role" defaultValue="TECHNICIAN">
              <option value="TECHNICIAN">Technician</option>
              <option value="ADMIN">Admin</option>
            </Select>
            <Input name="email" placeholder="Email (admins)" />
            <Input name="userCode" placeholder="User code (techs)" />
            <Select name="officeId" defaultValue="">
              <option value="">No office</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </Select>
            <Input name="password" placeholder="Password (admin)" />
            <Input name="pin" placeholder="4-digit PIN (tech)" />
            <Button type="submit" className="sm:col-span-5" disabled={isPending}>
              Add User
            </Button>
          </form>
        </div>
      </Card>

      <Card>
        <CardTitle>Required This Month Overrides ({month}/{year})</CardTitle>
        <CardDescription className="mt-1">
          Toggle required status for exceptional cases when a truck or office should be excluded.
        </CardDescription>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Offices</h3>
            {offices.map((office) => {
              const isRequired = officeRequired[office.id] ?? office.requiredByDefault;
              return (
                <div key={office.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-2 text-sm">
                  <span>{office.name}</span>
                  <Button
                    size="sm"
                    variant={isRequired ? "secondary" : "danger"}
                    onClick={() =>
                      runServerAction(
                        () =>
                          setMonthlyRequiredToggleAction({
                            month,
                            year,
                            targetType: RequirementTargetType.OFFICE,
                            targetId: office.id,
                            isRequired: !isRequired
                          }),
                        `Updated monthly required status for ${office.name}.`
                      )
                    }
                  >
                    {isRequired ? "Required" : "Not required"}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Trucks</h3>
            {trucks.map((truck) => {
              const isRequired = truckRequired[truck.id] ?? truck.requiredByDefault;
              return (
                <div key={truck.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-2 text-sm">
                  <span>
                    {truck.name} ({truck.licensePlate})
                  </span>
                  <Button
                    size="sm"
                    variant={isRequired ? "secondary" : "danger"}
                    onClick={() =>
                      runServerAction(
                        () =>
                          setMonthlyRequiredToggleAction({
                            month,
                            year,
                            targetType: RequirementTargetType.TRUCK,
                            targetId: truck.id,
                            isRequired: !isRequired
                          }),
                        `Updated monthly required status for ${truck.name}.`
                      )
                    }
                  >
                    {isRequired ? "Required" : "Not required"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
