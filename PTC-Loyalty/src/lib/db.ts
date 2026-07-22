import { PrismaClient } from "@prisma/client";

/**
 * Build-safe DATABASE_URL resolution.
 *
 * Prisma validates that `env("DATABASE_URL")` (see prisma/schema.prisma:12)
 * exists at the moment `new PrismaClient()` is *constructed* — before any query
 * is ever run. During `next build` (e.g. on Vercel) the whole module graph is
 * imported, so if the variable is missing the build crashes with:
 *
 *   Error: Environment variable not found: DATABASE_URL → schema.prisma:12
 *
 * To keep the build resilient when DATABASE_URL is not (yet) configured, we fall
 * back to a syntactically valid placeholder connection string. This only allows
 * the client to be *constructed*; Prisma opens no connection until an actual
 * query runs. At runtime with a real DATABASE_URL set, this block does nothing
 * and behaviour is completely unchanged.
 *
 * `isDatabaseConfigured` is exported so callers can, if they wish, skip DB work
 * when only the placeholder is present (e.g. during a preview build).
 */
const PLACEHOLDER_DATABASE_URL =
  "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

if (!isDatabaseConfigured) {
  process.env.DATABASE_URL = PLACEHOLDER_DATABASE_URL;
  // Surfaced during build and at runtime so a missing config is never silent.
  console.warn(
    "[db] DATABASE_URL is not set — using a placeholder connection string so the " +
      "build can proceed. Set DATABASE_URL in your environment (e.g. Vercel → " +
      "Project Settings → Environment Variables) before running any real queries.",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
