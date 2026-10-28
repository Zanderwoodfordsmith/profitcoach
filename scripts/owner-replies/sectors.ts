/**
 * Owner replies analysis: map each guessed industry to a broad sector, so themes can be counted by sector.
 *   npx tsx --tsconfig tsconfig.json scripts/owner-replies/sectors.ts <dir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && l.slice(0, i).trim() === "ANTHROPIC_API_KEY") process.env.ANTHROPIC_API_KEY = l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const DIR = process.argv[2];
const SECTORS = [
  "Manufacturing and engineering", "Construction and property", "IT, software and tech", "Professional services (legal, accounting, finance)",
  "Marketing, design and media", "Retail, hospitality and food", "Health, care and wellbeing", "Recruitment and HR",
  "Business coaching and consulting", "Logistics, transport and wholesale", "Energy, environment and utilities", "Education, charity and public sector", "Other or unknown",
];

async function main() {
  const conv: Record<string, { industry_guess: string }> = JSON.parse(readFileSync(join(DIR, "conv_tags.json"), "utf8"));
  const names = [...new Set(Object.values(conv).map((t) => (t.industry_guess || "unknown").trim().toLowerCase()))];
  const client = new Anthropic({ maxRetries: 3 });
  const map: Record<string, string> = {};
  let usd = 0;
  for (let i = 0; i < names.length; i += 300) {
    const part = names.slice(i, i + 300);
    const response = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 16000,
      system: `Map each industry label to exactly one of these sectors: ${SECTORS.join(" | ")}. Return every label once.`,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object", additionalProperties: false, required: ["items"],
            properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "sector"], properties: { label: { type: "string" }, sector: { type: "string", enum: SECTORS } } } } },
          },
        },
      },
      messages: [{ role: "user", content: part.join("\n") }],
    } as Anthropic.Messages.MessageCreateParamsNonStreaming);
    usd += (response.usage.input_tokens * 0.1 + response.usage.output_tokens * 0.5) / 1_000_000;
    const text = response.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text").map((b) => b.text).join("");
    for (const it of (JSON.parse(text) as { items: { label: string; sector: string }[] }).items) map[it.label.trim().toLowerCase()] = it.sector;
  }
  writeFileSync(join(DIR, "sectors.json"), JSON.stringify({ map, usd: Math.round(usd * 1000) / 1000 }));
  console.log(`${names.length} labels, ${Object.keys(map).length} mapped, $${usd.toFixed(3)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
