import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  assessProgrammeShortfall,
  listUnrecoveredFailedCharges,
} from "/Users/zander/Coding/profit-coach-app/src/lib/admin/programmeShortfall.ts";

const env = readFileSync("/Users/zander/Coding/profit-coach-app/.env.local", "utf8");
for (const line of env.split("\n")) {
  const match = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
  if (!match) continue;
  process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const payments: Array<Record<string, string | number | null>> = [];
let from = 0;
while (true) {
  const res = await supabase
    .from("coach_payments")
    .select(
      "coach_id,amount_cents,currency,status,paid_at,customer_email,decline_reason,description"
    )
    .range(from, from + 999);
  if (res.error) throw new Error(res.error.message);
  payments.push(...((res.data ?? []) as Array<Record<string, string | number | null>>));
  if (!res.data || res.data.length < 1000) break;
  from += 1000;
}

const profiles: Array<{
  id: string;
  full_name: string | null;
  disco_community_joined_on: string | null;
}> = [];
from = 0;
while (true) {
  const res = await supabase
    .from("profiles")
    .select("id, full_name, disco_community_joined_on")
    .range(from, from + 999);
  if (res.error) throw new Error(res.error.message);
  profiles.push(...(res.data ?? []));
  if (!res.data || res.data.length < 1000) break;
  from += 1000;
}

const byId = new Map(profiles.map((profile) => [profile.id, profile]));
const byCoach = new Map<string, Array<Record<string, string | number | null>>>();
for (const payment of payments) {
  const coachId = payment.coach_id as string | null;
  if (!coachId) continue;
  const list = byCoach.get(coachId) ?? [];
  list.push(payment);
  byCoach.set(coachId, list);
}

const flagged: Array<{ name: string | null; kind: string; short: number }> = [];
for (const profile of profiles) {
  const pays = byCoach.get(profile.id) ?? [];
  const result = assessProgrammeShortfall({
    joinedAt: profile.disco_community_joined_on,
    payments: pays.map((payment) => ({
      amountCents: payment.amount_cents as number,
      currency: String(payment.currency),
      status: String(payment.status),
      paidAt: String(payment.paid_at),
    })),
  });
  if (!result) continue;
  flagged.push({
    name: profile.full_name,
    kind: result.kind,
    short: result.short_cents,
  });
}
flagged.sort((a, b) => b.short - a.short);
console.log("FLAGGED", flagged.length);
for (const row of flagged) {
  console.log(row.kind, row.name, "£" + row.short / 100);
}
const names = new Set(flagged.map((row) => row.name));
for (const name of [
  "Alastair Macintyre",
  "Doug Rice",
  "Chris Shaw",
  "Michael Jones",
  "Alex Thompson",
  "Terence Monaghan",
  "Alistair Rennie",
  "Scott Geller",
  "Todd Cummings",
  "Will Walsh",
  "Stuart Whitehouse",
]) {
  console.log("HAS", name, names.has(name));
}

const failed = listUnrecoveredFailedCharges(
  payments.map((payment) => ({
    coachId: (payment.coach_id as string | null) ?? null,
    coachSlug: null,
    coachName: byId.get(payment.coach_id as string)?.full_name ?? null,
    email: String(payment.customer_email),
    amountCents: payment.amount_cents as number,
    currency: String(payment.currency),
    status: String(payment.status),
    paidAt: String(payment.paid_at),
    declineReason: (payment.decline_reason as string | null) ?? null,
    description: (payment.description as string | null) ?? null,
  }))
);
console.log("FAILED GROUPS", failed.length);
for (const row of failed.slice(0, 25)) {
  console.log(
    row.coachName,
    row.latestCurrency,
    row.latestAmountCents / 100,
    "x" + row.failureCount,
    row.latestPaidAt.slice(0, 10)
  );
}
