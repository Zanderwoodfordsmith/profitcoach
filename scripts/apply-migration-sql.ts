/**
 * Apply a supabase/migrations/*.sql file via direct Postgres.
 *
 * Needs one of (in .env.local):
 *   DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-….pooler.supabase.com:6543/postgres
 *   or
 *   SUPABASE_DB_PASSWORD=…   (uses NEXT_PUBLIC_SUPABASE_URL project ref + pooler)
 *
 * Usage:
 *   npx tsx scripts/apply-migration-sql.ts supabase/migrations/20260922120000_first_campaign_setup.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return direct;

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const poolerHost = process.env.SUPABASE_POOLER_HOST?.trim();
  if (!password || !supabaseUrl) {
    throw new Error(
      "Missing DATABASE_URL (preferred) or SUPABASE_DB_PASSWORD in .env.local.\n" +
        "Easiest: Dashboard → Connect → Session pooler → copy URI → DATABASE_URL=…"
    );
  }

  const ref = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
  if (!ref) throw new Error(`Could not parse project ref from ${supabaseUrl}`);

  const encoded = encodeURIComponent(password);
  if (poolerHost) {
    return `postgresql://postgres.${ref}:${encoded}@${poolerHost}:5432/postgres`;
  }

  // This project's session pooler (discovered via live probe).
  return `postgresql://postgres.${ref}:${encoded}@aws-1-eu-west-2.pooler.supabase.com:5432/postgres`;
}

async function main() {
  loadEnvLocal();
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Usage: npx tsx scripts/apply-migration-sql.ts <path-to.sql>"
    );
    process.exit(1);
  }
  const abs = resolve(process.cwd(), file);
  const sql = readFileSync(abs, "utf8");
  const url = resolveDatabaseUrl();
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`Applying ${file}…`);
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
