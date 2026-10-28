/**
 * Patterns across markets: reads the <slug>.json files from research-market-pains
 * and writes patterns.md. Pains in 3+ markets, with owners per market and one
 * exact quote each, then what is unique to each market. One grouping call
 * (ids only); counts and quotes come from the files, never from the model.
 *
 *   npx tsx scripts/research-pain-patterns.ts --dir <folder with the json files>
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";
import Anthropic from "@anthropic-ai/sdk";

import type { MarketPainsResult } from "../src/lib/research/marketPains";

loadEnvConfig(process.cwd());

const MODEL = "claude-opus-5-5";

function arg(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] ?? null : null;
}

type Unit = { id: string; market: string; name: string; owners: number; quote: string; url: string };

async function main() {
  const dir = arg("--dir");
  if (!dir) throw new Error("Pass --dir.");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const markets: { title: string; result: MarketPainsResult }[] = files.map((f) => {
    const data = JSON.parse(readFileSync(join(dir, f), "utf8")) as MarketPainsResult & { title: string };
    return { title: data.title, result: data };
  });

  const units: Unit[] = [];
  for (const m of markets) {
    m.result.pains.forEach((p, i) => {
      const q = p.quotes[0];
      if (!q) return;
      units.push({ id: `${units.length + 1}`, market: m.title, name: p.name, owners: p.owners, quote: q.quote, url: q.url });
    });
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["themes"],
          properties: {
            themes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "ids"],
                properties: { name: { type: "string" }, ids: { type: "array", items: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    system: "You find the same business problem across different markets. Return ids only. Answer in JSON only.",
    messages: [
      {
        role: "user",
        content: `Each line is one problem that UK business owners in one market describe: id | market | problem | start of a quote.

Group lines that are the same underlying problem, even when the market words differ (e.g. "can't find a good manager" in gyms and "no one to run the shop floor" in manufacturing). Name each theme in plain owner words, 3 to 8 words. A line can sit in one theme only. Leave lines that match nothing out.

${units.map((u) => `${u.id} | ${u.market} | ${u.name} | ${u.quote.slice(0, 90).replace(/\s+/g, " ")}`).join("\n")}`,
      },
    ],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);
  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const themes = (JSON.parse(text) as { themes: { name: string; ids: string[] }[] }).themes;
  const byId = new Map(units.map((u) => [u.id, u]));
  const used = new Set<string>();

  const rows = themes
    .map((t) => {
      const members = t.ids.filter((id) => byId.has(id) && !used.has(id)).map((id) => byId.get(id)!);
      members.forEach((m) => used.add(m.id));
      const perMarket = new Map<string, Unit[]>();
      for (const m of members) (perMarket.get(m.market) ?? perMarket.set(m.market, []).get(m.market)!).push(m);
      return { name: t.name, perMarket };
    })
    .filter((t) => t.perMarket.size >= 2)
    .sort((a, b) => b.perMarket.size - a.perMarket.size);

  const cost = ((response.usage.input_tokens ?? 0) * 4 + (response.usage.output_tokens ?? 0) * 20) / 1_000_000;
  const out: string[] = [
    "# Pains across markets",
    "",
    `Markets: ${markets.map((m) => m.title).join(", ")}. Grouped by ${MODEL} (ids only, $${cost.toFixed(3)}); counts and quotes come from each market's research file.`,
    "",
  ];
  const section = (title: string, list: typeof rows) => {
    out.push(`## ${title}`, "");
    if (!list.length) out.push("None.", "");
    for (const t of list) {
      out.push(`### ${t.name} (${t.perMarket.size} markets)`, "");
      for (const [market, us] of t.perMarket) {
        const owners = us.reduce((n, u) => n + u.owners, 0);
        out.push(`- **${market}:** ${owners} ${owners === 1 ? "owner" : "owners"}. "${us[0]!.quote}" (${us[0]!.url})`);
      }
      out.push("");
    }
  };
  section("In 3 or more markets", rows.filter((t) => t.perMarket.size >= 3));
  section("In 2 markets", rows.filter((t) => t.perMarket.size === 2));
  out.push("## Unique to one market", "");
  for (const m of markets) {
    const own = units.filter((u) => u.market === m.title && !rows.some((r) => [...r.perMarket.values()].flat().includes(u)));
    out.push(`- **${m.title}:** ${own.length ? own.map((u) => `${u.name} (${u.owners})`).join("; ") : "nothing of its own"}`);
  }
  out.push("");
  writeFileSync(join(dir, "patterns.md"), out.join("\n"));
  console.log(`Wrote ${join(dir, "patterns.md")} ($${cost.toFixed(3)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
