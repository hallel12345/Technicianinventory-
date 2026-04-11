"use client";

import { useActionState, useState } from "react";

import { adminLoginAction, technicianLoginAction, type AuthActionState } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState: AuthActionState = {};

export function LoginPanels() {
  const [tab, setTab] = useState<"technician" | "admin">("technician");
  const [techState, techAction, techPending] = useActionState(technicianLoginAction, initialState);
  const [adminState, adminAction, adminPending] = useActionState(adminLoginAction, initialState);

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 shadow-sm">
        <Button variant={tab === "technician" ? "primary" : "ghost"} onClick={() => setTab("technician")}>
          Technician
        </Button>
        <Button variant={tab === "admin" ? "primary" : "ghost"} onClick={() => setTab("admin")}>
          Admin
        </Button>
      </div>

      {tab === "technician" ? (
        <Card>
          <CardTitle>Technician Sign-In</CardTitle>
          <CardDescription className="mt-1">Enter your 4-digit technician PIN.</CardDescription>
          <form action={techAction} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">PIN</label>
              <Input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} required />
            </div>
            {techState.error ? <p className="text-sm text-red-600">{techState.error}</p> : null}
            <Button type="submit" className="w-full" disabled={techPending}>
              {techPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>
      ) : (
        <Card>
          <CardTitle>Admin Sign-In</CardTitle>
          <CardDescription className="mt-1">Enter admin password.</CardDescription>
          <form action={adminAction} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <Input name="password" type="password" required />
            </div>
            {adminState.error ? <p className="text-sm text-red-600">{adminState.error}</p> : null}
            <Button type="submit" className="w-full" disabled={adminPending}>
              {adminPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
