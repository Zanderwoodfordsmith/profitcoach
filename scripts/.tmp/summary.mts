import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const i = t.indexOf("="); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[t.slice(0, i).trim()] ??= v; }
const { ensurePracticeKnowledge } = await import("@/lib/practiceKnowledge/store");
const { summarizeKnowledgeForPrompt } = await import("@/lib/practiceKnowledge/prompts");
const row = await ensurePracticeKnowledge("5cb89c87-88a9-4cfc-9f95-9591f74f8529");
console.log(summarizeKnowledgeForPrompt(row.payload));
