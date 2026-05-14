// Verify the strip-on-PGRST204 path works against the live DB.
//   node scripts/debug-contact-insert.mjs
import { readFileSync } from "node:fs";

function loadEnv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!m) continue;
      let value = m[2];
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {}
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE creds in .env.local");
  process.exit(1);
}
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

function dropMissing(payload, err) {
  if (err?.code === "PGRST204") {
    const m = /'(\w+)' column of 'contacts'/i.exec(err.message ?? "");
    if (m && m[1] in payload) {
      const { [m[1]]: _, ...rest } = payload;
      return [rest, m[1]];
    }
  }
  if (err?.code === "42703") {
    const m = /column "([^"]+)" of relation "contacts"/i.exec(err.message ?? "");
    if (m && m[1] in payload) {
      const { [m[1]]: _, ...rest } = payload;
      return [rest, m[1]];
    }
  }
  return null;
}

async function strippingInsert(initial) {
  let payload = { ...initial };
  const stripped = [];
  for (let i = 0; i < 6; i += 1) {
    const r = await rest("contacts", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { Prefer: "return=representation" },
    });
    if (r.status >= 200 && r.status < 300) return { ok: true, stripped, result: r.json };
    const drop = dropMissing(payload, r.json);
    if (!drop) return { ok: false, stripped, error: r.json, status: r.status };
    payload = drop[0];
    stripped.push(drop[1]);
  }
  return { ok: false, stripped, error: "max-retries" };
}

const coach = await rest("coaches?select=id&slug=eq.bca");
const coachId = coach.json?.[0]?.id;
if (!coachId) { console.error("No bca coach"); process.exit(2); }

const out = await strippingInsert({
  coach_id: coachId,
  type: "prospect",
  full_name: "STRIP TEST",
  email: `strip+${Date.now()}@noemail.local`,
  business_name: "Strip Biz",
  phone: null,
  first_name: "STRIP",
  last_name: "TEST",
});
console.log(JSON.stringify(out, null, 2));
