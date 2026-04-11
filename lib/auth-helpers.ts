import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) {
    if (role === Role.ADMIN) {
      redirect("/inventory");
    }
    redirect("/admin");
  }
  return user;
}

export async function requireTechnician() {
  return requireRole(Role.TECHNICIAN);
}

export async function requireAdmin() {
  return requireRole(Role.ADMIN);
}
