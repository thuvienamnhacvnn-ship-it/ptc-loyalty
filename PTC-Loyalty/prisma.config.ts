// Prisma configuration (replaces the deprecated `package.json#prisma` block,
// removed in Prisma 7). See https://pris.ly/prisma-config
//
// IMPORTANT: when a Prisma config file is present, Prisma no longer auto-loads
// `.env`. We import dotenv here so CLI commands (migrate / db push / db seed /
// studio) keep reading DATABASE_URL from `.env`, exactly as before.
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    // Previously `package.json#prisma.seed`.
    seed: "tsx prisma/seed.ts",
  },
});
