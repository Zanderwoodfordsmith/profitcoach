import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[t.slice(0, i).trim()] ??= v;
}
const COACH = "5cb89c87-88a9-4cfc-9f95-9591f74f8529";
const { generateCampaignJson } = await import("@/lib/firstCampaign/generateJson");
const { loadCoachLinkedInSummary } = await import("@/lib/firstCampaign/loadCoachContext");
const { ensurePracticeKnowledge, getActiveIntakeSession } = await import("@/lib/practiceKnowledge/store");
const { buildInterviewUser, PRACTICE_INTERVIEW_SYSTEM } = await import("@/lib/practiceKnowledge/prompts");
const { openQuestions } = await import("@/lib/practiceKnowledge/blueprint");
const knowledge = await ensurePracticeKnowledge(COACH);
const session = await getActiveIntakeSession(COACH);
const lastAnswer = "Three things come up again and again. First is margin, they're winning work but the money leaks away between the quote and the final account. Second is getting out of the day-to-day, the MD still makes every decision. Third is cash flow, specifically retentions.";
const turns = [...(session?.turns ?? []), { role: "user" as const, content: lastAnswer, at: new Date().toISOString() }];
console.log("TURNS", turns.length);
const { summary } = await loadCoachLinkedInSummary(COACH);
const out = await generateCampaignJson<Record<string, unknown>>({
  system: PRACTICE_INTERVIEW_SYSTEM,
  user: buildInterviewUser({ linkedinSummary: summary, knowledge: knowledge.payload, turns, userMessage: turns.at(-1)!.content, stillOpen: openQuestions(knowledge) }),
  maxTokens: 2048,
});
console.log("ERROR:", out.error);
console.log("RAW:", out.raw.slice(0, 3000));
