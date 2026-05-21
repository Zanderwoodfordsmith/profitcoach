/**
 * Smoke tests for GHL appointment webhook parsing and embed extraction.
 * Run: npx tsx scripts/test-ghl-appointment-webhook.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { extractGhlCalendarIdFromEmbed } from "../src/lib/extractGhlCalendarIdFromEmbed";
import {
  normalizeGhlAppointmentStatus,
  parseGhlAppointmentWebhookPayload,
} from "../src/lib/ghlAppointmentWebhook";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

const embed =
  '<iframe src="https://link.procoachplatform.com/widget/booking/YBxvoiQH6HcHjHYrOWkU"></iframe>';
assert(
  extractGhlCalendarIdFromEmbed(embed) === "YBxvoiQH6HcHjHYrOWkU",
  "extractGhlCalendarIdFromEmbed"
);

assert(
  normalizeGhlAppointmentStatus("cancelled").normalized === "cancelled",
  "normalize cancelled"
);
assert(
  normalizeGhlAppointmentStatus(undefined, "no show").normalized === "noshow",
  "normalize noshow typo field"
);

const fixturePath = join(
  process.cwd(),
  "scripts/fixtures/ghl-appointment-webhook-sample.json"
);
const sample = JSON.parse(readFileSync(fixturePath, "utf8"));
const parsed = parseGhlAppointmentWebhookPayload(sample);
assert(!("error" in parsed), "parse sample payload");
if (!("error" in parsed)) {
  assert(
    parsed.ghlAppointmentId === "test-appointment-123",
    "appointment id parsed"
  );
  assert(parsed.statusNormalized === "confirmed", "status normalized");
  assert(parsed.prospectEmail === "alex.prospect@example.com", "email normalized");
}

const missing = parseGhlAppointmentWebhookPayload({ email: "a@b.com" });
assert(
  "error" in missing && missing.error.includes("calendar"),
  "reject missing calendar"
);

console.log("\nAll GHL webhook parsing checks passed.");
