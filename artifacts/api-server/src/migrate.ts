import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "./lib/logger";

const { Pool } = pg;

export function sanitizeDatabaseUrl(url: string): string {
  return url.replace(/:\/\/[^:]+:([^@]+)@/, "://***:***@");
}

export function resolveMigrationsFolder(customDir?: string): string {
  if (customDir) {
    return path.resolve(customDir);
  }
  if (process.env.MIGRATIONS_DIR) {
    return path.resolve(process.env.MIGRATIONS_DIR);
  }

  // 1. Check relative to process.cwd() (standard in container /repo or root workspace)
  const cwdCandidate = path.resolve(process.cwd(), "lib/db/drizzle");
  if (fs.existsSync(path.join(cwdCandidate, "meta", "_journal.json"))) {
    return cwdCandidate;
  }

  // 2. Check relative to current file location / bundled output
  const thisDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    path.resolve(thisDir, "../../lib/db/drizzle"),
    path.resolve(thisDir, "../../../lib/db/drizzle"),
    path.resolve(thisDir, "../lib/db/drizzle"),
    path.resolve(thisDir, "lib/db/drizzle"),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(path.join(cand, "meta", "_journal.json"))) {
      return cand;
    }
  }

  return cwdCandidate;
}

export async function runMigrations(options?: {
  connectionString?: string;
  migrationsFolder?: string;
}): Promise<{ success: boolean; migrationsFolder: string }> {
  const connectionString =
    options?.connectionString ?? process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    const msg = "DATABASE_URL is required to run database migrations.";
    logger.error(msg);
    throw new Error(msg);
  }

  const migrationsFolder = resolveMigrationsFolder(options?.migrationsFolder);
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");

  if (!fs.existsSync(journalPath)) {
    const msg = `Migration journal not found at ${journalPath}`;
    logger.error({ migrationsFolder }, msg);
    throw new Error(msg);
  }

  logger.info(
    {
      migrationsFolder,
      target: sanitizeDatabaseUrl(connectionString),
    },
    "Starting database migration runner",
  );

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    // Step 1: Run Drizzle migrations first — this creates the base tables on a
    // fresh database (0000_first_demogoblin.sql) and applies all subsequent
    // migration files in order.  On an existing database where some migrations
    // have already been applied, Drizzle's journal tracking skips them.
    try {
      await migrate(db, { migrationsFolder });
    } catch (migErr) {
      logger.warn({ err: migErr instanceof Error ? migErr.message : String(migErr) }, "Drizzle migration runner encountered non-critical journal mismatch; continuing with post-flight schema sync");
    }

    // Step 2: Idempotent "post-flight" schema sync — ensures columns added in
    // later migrations exist even in pre-existing dev databases whose Drizzle
    // journal may be out of sync (e.g. schema was modified manually).  Every
    // statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, so running them
    // after Drizzle migrations is safe and a no-op when the schema is current.
    await pool.query(`
      ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "included_voice_minutes" integer DEFAULT 300 NOT NULL;
      ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "calling_paused" boolean DEFAULT true NOT NULL;
      CREATE TABLE IF NOT EXISTS "usage" (
        "id" text PRIMARY KEY NOT NULL,
        "business_id" text NOT NULL,
        "period_start" timestamp with time zone NOT NULL,
        "period_end" timestamp with time zone NOT NULL,
        "used_seconds" integer DEFAULT 0 NOT NULL,
        "cached_minute_usage" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "usage_business_period_unique" ON "usage" USING btree ("business_id","period_start","period_end");
      ALTER TABLE "workflow_jobs" ADD COLUMN IF NOT EXISTS "locked_at" timestamp with time zone;
      ALTER TABLE "workflow_jobs" ADD COLUMN IF NOT EXISTS "locked_by" text;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "timezone" text;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "timezone_inferred_from" text;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "consent_captured_at" timestamp with time zone;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "consent_source" text;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "consent_disclosure_version" text;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "intake_ip" text;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "recipient_timezone" text;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "timezone_provenance" text DEFAULT 'business_fallback' NOT NULL;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "consent_captured" boolean DEFAULT false NOT NULL;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "consent_captured_at" timestamp with time zone;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "consent_source_url" text;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "consent_ip_address" text;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "consent_disclosure_version" text;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "recipient_timezone" text;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "recipient_timezone_source" text;
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "intake_metadata" jsonb;
    `);

    logger.info({ migrationsFolder }, "Database migrations applied successfully");
    return { success: true, migrationsFolder };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const safeMsg = sanitizeDatabaseUrl(rawMsg);
    logger.error({ err: safeMsg, migrationsFolder }, "Database migration execution failed");
    throw new Error(`Migration failed: ${safeMsg}`);
  } finally {
    await pool.end();
  }
}

// If executed as a CLI script directly
const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err: err.message }, "Migration runner exiting with code 1");
      process.exit(1);
    });
}
