/**
 * Owner replies analysis, step 3: Opus groups owner pain quotes into themes and campaign messages
 * into angles. It returns ids only, so no quote is reworded. Reads and writes JSON in the folder given.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/owner-replies/group.ts <dir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && l.slice(0, i).trim() === "ANTHROPIC_API_KEY") process.env.ANTHROPIC_API_KEY = l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const DIR = process.argv[2];
const MODEL = "claude-opus-5-5";
const client = new Anthropic({ maxRetries: 3 });
let usd = 0;

const GROUPS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["groups"],
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "meaning", "ids"],
        properties: { name: { type: "string" }, meaning: { type: "string" }, ids: { type: "array", items: { type: "string" } } },
      },
    },
  },
};

type Groups = { groups: { name: string; meaning: string; ids: string[] }[] };

async function group(system: string, items: string[]): Promise<Groups> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system,
    output_config: { effort: "medium", format: { type: "json_schema", schema: GROUPS_SCHEMA } },
    messages: [{ role: "user", content: items.join("\n") }],
  } as Anthropic.Messages.MessageStreamParams);
  const response = await stream.finalMessage();
  usd += (response.usage.input_tokens * 4 + response.usage.output_tokens * 20) / 1_000_000;
  if (response.stop_reason !== "end_turn") throw new Error(`Opus stopped: ${response.stop_reason}`);
  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as Groups;
}

type ConvTag = { speaker: string; pains: { quote: string; short: string }[] };
type StepTag = { pain_named: string; promise: string; offer: string; format: string; proof: string };

async function main() {
  const conv: Record<string, ConvTag> = JSON.parse(readFileSync(join(DIR, "conv_tags.json"), "utf8"));
  const stepTags: Record<string, StepTag> = JSON.parse(readFileSync(join(DIR, "step_tags.json"), "utf8"));

  const OWNERS = new Set(["owner_or_md", "director_or_partner"]);
  const pains: { id: string; conv: string; quote: string; short: string }[] = [];
  for (const [cid, t] of Object.entries(conv)) {
    if (!OWNERS.has(t.speaker)) continue;
    t.pains.forEach((p, i) => pains.push({ id: `p${pains.length + 1}`, conv: cid, quote: p.quote, short: p.short }));
    void 0;
  }
  console.log(`${pains.length} owner pain quotes`);
  const painGroups = await group(
    `You are given pain quotes from UK business owners replying to a business coach, one per line as "id | short label | exact quote".
Group them into 10 to 20 themes by the underlying business problem (not by wording). Every id goes in exactly one theme; put odd ones in a theme named "Other". Name each theme in 3 to 7 plain words a 12-year-old would understand, and give its meaning in one plain sentence. Return ids only, never rewrite quotes.`,
    pains.map((p) => `${p.id} | ${p.short} | ${p.quote.replace(/\s+/g, " ").slice(0, 300)}`)
  );

  const stepItems = Object.entries(stepTags).map(([id, t], i) => ({ id: `s${i + 1}`, step: id, t }));
  const angleGroups = await group(
    `You are given outreach messages UK business coaches sent to owners, one per line as "id | pain named | promise | offer | format".
Group them into 8 to 15 angles: the main pain-and-promise pitch the message leads with (for example "stop being the bottleneck", "more profit without more hours", "free BOSS Score / scorecard", "plain hello, no pitch", "a question about their business", "compliment or common ground"). Every id goes in exactly one angle. Name each angle in 3 to 7 plain words, meaning in one plain sentence. Return ids only.`,
    stepItems.map((s) => `${s.id} | ${s.t.pain_named} | ${s.t.promise} | ${s.t.offer} | ${s.t.format}`)
  );

  writeFileSync(
    join(DIR, "groups.json"),
    JSON.stringify({ pains, painGroups: painGroups.groups, steps: stepItems.map(({ id, step }) => ({ id, step })), angleGroups: angleGroups.groups, opus_usd: Math.round(usd * 1000) / 1000 })
  );
  console.log(`themes ${painGroups.groups.length}, angles ${angleGroups.groups.length}, Opus $${usd.toFixed(3)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
