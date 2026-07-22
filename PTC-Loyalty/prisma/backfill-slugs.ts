/**
 * Backfill random slugs for any Business row that is missing one.
 *
 * The `Business.slug` column is required + @unique, so in a healthy DB there is
 * nothing to fix — this script exists as a safe, idempotent guard for legacy
 * rows that may have an empty slug. It NEVER changes an existing non-empty slug
 * and never creates a duplicate.
 *
 * Run with:  npx tsx prisma/backfill-slugs.ts
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function generateBusinessSlug(): string {
  return `biz-${crypto.randomBytes(6).toString("hex")}`;
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const slug = generateBusinessSlug();
    const clash = await db.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!clash) return slug;
  }
  return `biz-${crypto.randomBytes(9).toString("hex")}`;
}

async function main() {
  // Only rows with an empty / whitespace-only slug.
  const missing = await db.business.findMany({
    where: { slug: { in: ["", " "] } },
    select: { id: true, name: true, slug: true },
  });

  if (missing.length === 0) {
    console.log("✓ No businesses missing a slug — nothing to backfill.");
    return;
  }

  for (const biz of missing) {
    const slug = await uniqueSlug();
    await db.business.update({ where: { id: biz.id }, data: { slug } });
    console.log(`  fixed ${biz.name} (${biz.id}) -> ${slug}`);
  }
  console.log(`✓ Backfilled ${missing.length} business slug(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
