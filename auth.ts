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
  trustHost: true,
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
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const password = String(credentials?.password ?? "");

        if (!password) {
          return null;
        }

        const eligibleAdmins = await db.user.findMany({
          where: {
            role: Role.ADMIN,
            isActive: true,
            passwordHash: { not: null },
            OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }]
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            officeId: true,
            passwordHash: true,
            failedLoginAttempts: true
          }
        });

        if (!eligibleAdmins.length) {
          return null;
        }

        const matchedUsers: Array<(typeof eligibleAdmins)[number]> = [];
        for (const user of eligibleAdmins) {
          if (!user.passwordHash) {
            continue;
          }
          const matches = await bcrypt.compare(password, user.passwordHash);
          if (matches) {
            matchedUsers.push(user);
          }
        }

        if (!matchedUsers.length) {
          if (eligibleAdmins.length === 1) {
            await handleFailedLogin(eligibleAdmins[0].id, eligibleAdmins[0].failedLoginAttempts);
          }
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
    })
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return url;
      }

      try {
        const target = new URL(url);
        const base = new URL(baseUrl);

        if (target.origin === base.origin) {
          return `${target.pathname}${target.search}${target.hash}`;
        }
      } catch {
        // Fall through to safe default.
      }

      return "/";
    },
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
