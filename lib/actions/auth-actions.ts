"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";

export type AuthActionState = {
  success?: boolean;
  error?: string;
};

export async function technicianLoginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const pin = String(formData.get("pin") ?? "").trim();

  if (!/^\d{4}$/.test(pin)) {
    return { error: "A valid 4-digit PIN is required." };
  }

  try {
    await signIn("technician-pin", {
      pin,
      redirectTo: "/inventory"
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid credentials or account locked." };
    }
    throw error;
  }
}

export async function adminLoginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    await signIn("admin-password", {
      email,
      password,
      redirectTo: "/admin"
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid admin credentials or account locked." };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
