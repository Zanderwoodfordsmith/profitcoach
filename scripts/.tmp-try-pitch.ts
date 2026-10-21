/**
 * Smoke the personalised-pitch capability against a sample prospect.
 * Run: npx tsx scripts/.tmp-try-pitch.ts
 */
import { loadEnvConfig } from "@next/env";
import Anthropic from "@anthropic-ai/sdk";

loadEnvConfig(process.cwd());

import { capabilityContract, getCapability, loadIdentity } from "../src/lib/agent/context";

const key = process.env.ANTHROPIC_API_KEY?.trim();
if (!key) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const cap = getCapability("personalised-pitch", "coach");
if (!cap) {
  console.error("personalised-pitch is not a coach capability");
  process.exit(1);
}

const system = [
  loadIdentity(),
  "# This session",
  "Mode: coach. Capability personalised-pitch is already open.",
  capabilityContract(cap),
].join("\n\n---\n\n");

const anthropic = new Anthropic({ apiKey: key });
const model = process.env.AGENT_ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";

async function ask(label: string, text: string) {
  console.log(`\n\n======== ${label} ========\n`);
  const res = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: text }],
  });
  const out = res.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
  console.log(out);
  return out;
}

async function main() {
  await ask(
    "LEARN THE CORE",
    "I have a sales call next week. What parts of the Profit System pitch should I actually learn, so I am not reading a new script every time?"
  );

  await ask(
    "TAILOR FOR DAVE",
    `Write me the pitch for this prospect. Discovery notes from yesterday:

Name: Dave. MD of a 28-person scaffolding firm in Yorkshire. About £3.2m turnover.
He is still on the tools 4 days a week. Everything comes back to him: quotes, site problems, the lads ringing him at 7pm.
Working 60 hours. He said he is knackered.
Number-one priority: get off the tools. Wants to be on site one day a week within 12 months, not four.
Personal why: take the family to Spain for two weeks without the phone going.
Profit is "fine but I cannot enjoy it." He has a contracts manager who still checks every decision with him.
Do not invent anything I did not tell you.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
