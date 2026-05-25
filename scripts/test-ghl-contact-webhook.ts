/**
 * Smoke tests for GHL contact webhook parsing.
 * Run: npx tsx scripts/test-ghl-contact-webhook.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildCrmContactDetailUrl,
  parseGhlContactWebhookPayload,
} from "../src/lib/ghlContactWebhook";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

const fixturePath = join(
  process.cwd(),
  "scripts/fixtures/ghl-contact-webhook-sample.json"
);
const sample = JSON.parse(readFileSync(fixturePath, "utf8"));
const parsed = parseGhlContactWebhookPayload(sample);
assert(!("error" in parsed), "parse sample payload");
if (!("error" in parsed)) {
  assert(
    parsed.crmContactId === "UsLL2LaM9Hi1E0YBsaLk",
    "crm contact id parsed"
  );
  assert(
    parsed.profitCoachContactId === "00000000-0000-4000-8000-000000000001",
    "profit coach contact id parsed"
  );
  assert(parsed.email === "alex.prospect@example.com", "email normalized");
  assert(parsed.ghlLocationId === "BsRxKtV0lVHcvvZ6qHtu", "location id parsed");
}

const withNames = parseGhlContactWebhookPayload({
  crm_contact_id: "4EtTsoPeXPYryiTwoQsM",
  email: "new.ghl@example.com",
  first_name: "Alex",
  last_name: "Prospect",
  phone: "+441234567890",
  location_id: "BsRxKtV0lVHcvvZ6qHtu",
});
assert(!("error" in withNames), "parse GHL-originated contact payload");
if (!("error" in withNames)) {
  assert(withNames.firstName === "Alex", "first name parsed");
  assert(withNames.phone === "+441234567890", "phone parsed");
}

const fromFlatContactId = parseGhlContactWebhookPayload({
  contact_id: "UsLL2LaM9Hi1E0YBsaLk",
  profit_coach_contact_id: "00000000-0000-4000-8000-000000000002",
  email: "a@b.com",
});
assert(!("error" in fromFlatContactId), "parse mixed contact_id keys");

const missing = parseGhlContactWebhookPayload({ email: "a@b.com" });
assert(
  "error" in missing && missing.error.includes("CRM contact id"),
  "reject missing crm contact id"
);

assert(
  buildCrmContactDetailUrl("BsRxKtV0lVHcvvZ6qHtu", "UsLL2LaM9Hi1E0YBsaLk") ===
    "https://app.procoachplatform.com/v2/location/BsRxKtV0lVHcvvZ6qHtu/contacts/detail/UsLL2LaM9Hi1E0YBsaLk",
  "build CRM contact detail URL"
);

console.log("\nAll GHL contact webhook parsing checks passed.");
