import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { UserRole } from "@prisma/client";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

/**
 * Edge-safe Auth.js config (no bcrypt / Prisma). Imported by both middleware
 * and the full node config in `auth.ts`. Credentials + adapter live in auth.ts
 * because they are not edge compatible.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: googleEnabled
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role?: UserRole }).role ?? "CUSTOMER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.role = (token.role as UserRole) ?? "CUSTOMER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
