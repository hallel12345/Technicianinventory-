import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { Role } from "@prisma/client";

import { db } from "@/lib/db";

const LOCKOUT_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

type LoginCandidate = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  officeId: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

function logAuthEvent(
  event:
    | "LOGIN_FAILED"
    | "LOGIN_FAILED_UNTRACKED"
    | "LOGIN_LOCKED"
    | "LOGIN_LOCK_APPLIED"
    | "LOGIN_UNLOCK_EXPIRED"
    | "LOGIN_SUCCESS_RESET",
  details: Record<string, unknown>
) {
  console.info(`[auth] ${event}`, details);
}

function isLocked(user: Pick<LoginCandidate, "lockedUntil">, now: Date) {
  return Boolean(user.lockedUntil && user.lockedUntil > now);
}

async function recordFailedAttempt(user: LoginCandidate, now: Date, reason: string) {
  let baseAttempts = user.failedLoginAttempts;
  if (user.lockedUntil && user.lockedUntil <= now) {
    logAuthEvent("LOGIN_UNLOCK_EXPIRED", {
      role: user.role,
      userId: user.id,
      reason: "expired-before-failed-attempt"
    });
    baseAttempts = 0;
  }

  const nextAttempts = baseAttempts + 1;
  const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
  const lockUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_WINDOW_MINUTES * 60_000) : null;

  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: nextAttempts,
      lockedUntil: lockUntil
    }
  });

  logAuthEvent("LOGIN_FAILED", {
    role: user.role,
    userId: user.id,
    reason,
    failedLoginAttempts: nextAttempts
  });

  if (shouldLock && lockUntil) {
    logAuthEvent("LOGIN_LOCK_APPLIED", {
      role: user.role,
      userId: user.id,
      lockUntil: lockUntil.toISOString()
    });
  }
}

async function resetSuccessfulLogin(user: LoginCandidate, now: Date) {
  if (user.lockedUntil && user.lockedUntil <= now) {
    logAuthEvent("LOGIN_UNLOCK_EXPIRED", {
      role: user.role,
      userId: user.id,
      reason: "expired-before-success"
    });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now
    }
  });

  logAuthEvent("LOGIN_SUCCESS_RESET", {
    role: user.role,
    userId: user.id
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
            pinHash: { not: null }
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            officeId: true,
            pinHash: true,
            failedLoginAttempts: true,
            lockedUntil: true
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
          const now = new Date();
          const unlockedCandidates = eligibleTechnicians.filter((user) => !isLocked(user, now));
          if (unlockedCandidates.length === 1) {
            await recordFailedAttempt(unlockedCandidates[0], now, "technician-pin-mismatch");
          } else {
            logAuthEvent("LOGIN_FAILED_UNTRACKED", {
              role: Role.TECHNICIAN,
              reason: "no-single-user-attribution",
              unlockedCandidateCount: unlockedCandidates.length
            });
          }
          return null;
        }
        const user = matchedUsers[0];
        const now = new Date();

        if (isLocked(user, now)) {
          logAuthEvent("LOGIN_LOCKED", {
            role: user.role,
            userId: user.id,
            lockUntil: user.lockedUntil?.toISOString() ?? null
          });
          return null;
        }

        await resetSuccessfulLogin(user, now);

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
            passwordHash: { not: null }
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            officeId: true,
            passwordHash: true,
            failedLoginAttempts: true,
            lockedUntil: true
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

        if (matchedUsers.length !== 1) {
          const now = new Date();
          const unlockedCandidates = eligibleAdmins.filter((user) => !isLocked(user, now));
          if (unlockedCandidates.length === 1) {
            await recordFailedAttempt(unlockedCandidates[0], now, "admin-password-mismatch");
          } else {
            logAuthEvent("LOGIN_FAILED_UNTRACKED", {
              role: Role.ADMIN,
              reason: "no-single-user-attribution",
              unlockedCandidateCount: unlockedCandidates.length
            });
          }
          return null;
        }
        const user = matchedUsers[0];
        const now = new Date();

        if (isLocked(user, now)) {
          logAuthEvent("LOGIN_LOCKED", {
            role: user.role,
            userId: user.id,
            lockUntil: user.lockedUntil?.toISOString() ?? null
          });
          return null;
        }

        await resetSuccessfulLogin(user, now);

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
