import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { Role } from "@prisma/client";

import { db } from "@/lib/db";

const LOCKOUT_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

async function handleFailedLogin(userId: string, attempts: number) {
  const nextAttempts = attempts + 1;
  const lockUntil =
    nextAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_WINDOW_MINUTES * 60_000)
      : null;

  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: nextAttempts,
      lockedUntil: lockUntil
    }
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      id: "technician-pin",
      name: "Technician PIN",
      credentials: {
        pin: { label: "PIN", type: "password" }
      },
      async authorize(credentials) {
        const pin = String(credentials?.pin ?? "");

        if (!/^\d{4}$/.test(pin)) {
          return null;
        }

        const eligibleTechnicians = await db.user.findMany({
          where: {
            role: Role.TECHNICIAN,
            isActive: true,
            pinHash: { not: null },
            OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }]
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            officeId: true,
            pinHash: true,
            failedLoginAttempts: true
          }
        });

        if (!eligibleTechnicians.length) {
          return null;
        }

        const matchedUsers: Array<(typeof eligibleTechnicians)[number]> = [];
        for (const user of eligibleTechnicians) {
          if (!user.pinHash) {
            continue;
          }
          const matches = await bcrypt.compare(pin, user.pinHash);
          if (matches) {
            matchedUsers.push(user);
          }
        }

        if (matchedUsers.length !== 1) {
          return null;
        }
        const user = matchedUsers[0];

        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date()
          }
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          officeId: user.officeId ?? undefined
        };
      }
    }),
    Credentials({
      id: "admin-password",
      name: "Admin Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          return null;
        }

        const user = await db.user.findFirst({
          where: {
            email,
            role: Role.ADMIN
          }
        });

        if (!user || !user.isActive || !user.passwordHash) {
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          await handleFailedLogin(user.id, user.failedLoginAttempts);
          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date()
          }
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          officeId: user.officeId ?? undefined
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        if (user.id) {
          token.id = user.id;
        }
        if (user.role) {
          token.role = user.role;
        }
        token.officeId = user.officeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? "";
        session.user.role = (token.role as Role | undefined) ?? Role.TECHNICIAN;
        session.user.officeId = token.officeId as string | undefined;
      }
      return session;
    }
  }
});
