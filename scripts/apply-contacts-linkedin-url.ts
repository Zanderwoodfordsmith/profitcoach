/**
 * Apply contacts.linkedin_url migration when CLI push isn't linked.
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/apply-contacts-linkedin-url.ts
 *
 * Or with SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL (tries pooler hosts).
 */
import fs from "fs";
import path from "path";
import { Client } from "pg";

const sqlPath = path.join(
  process.cwd(),
  "supabase/migrations/20261011120000_contacts_linkedin_url.sql"
);

async function tryConnect(connectionString: string): Promise<Client> {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  const direct = process.env.DATABASE_URL?.trim();
  const candidates: string[] = [];
  if (direct) candidates.push(direct);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (url && password) {
    const ref = new URL(url).hostname.split(".")[0];
    const enc = encodeURIComponent(password);
    for (const region of ["eu-west-1", "eu-central-1", "us-east-1"]) {
      for (const port of [6543, 5432]) {
        candidates.push(
          `postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:${port}/postgres`
        );
      }
    }
    candidates.push(
      `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`
    );
  }

  if (!candidates.length) {
    throw new Error(
      "Set DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD."
    );
  }

  let lastErr: unknown;
  for (const connectionString of candidates) {
    try {
      const client = await tryConnect(connectionString);
      await client.query(sql);
      await client.end();
      console.log("Applied contacts.linkedin_url migration.");
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Could not connect to Postgres.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
