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
  const userCode = String(formData.get("userCode") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!userCode || !pin) {
    return { error: "User code and PIN are required." };
  }

  try {
    await signIn("technician-pin", {
      userCode,
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
