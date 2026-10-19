import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import { mergeCoachAiContext } from "@/lib/profitCoachAi/loadCoachPromptContext";
import type { PracticeKnowledgePayload } from "./types";
import { foldRetiredAnswers, listValue, textValue } from "./sourced";

function formatCareerStories(payload: PracticeKnowledgePayload): Array<{
  title: string;
  story: string;
}> {
  const fromCareer = (payload.proof.career_results?.value ?? []).map((r) => {
    const title = [r.company, r.role].filter(Boolean).join(" · ") || "Career result";
    const metric =
      r.metric_from && r.metric_to
        ? `${r.metric_from} → ${r.metric_to}`
        : r.metric_to || r.metric_from;
    const parts = [
      metric,
      r.timeframe ? `in ${r.timeframe}` : "",
      r.mechanism ? `by ${r.mechanism}` : "",
    ].filter(Boolean);
    return { title, story: parts.join(" ") };
  });
  const fromClient = (payload.proof.client_results?.value ?? []).map((r) => ({
    title: r.title,
    story: r.story,
  }));
  return [...fromCareer, ...fromClient].filter((r) => r.title || r.story);
}

export function brainPatchFromPractice(
  raw: PracticeKnowledgePayload
): Partial<CoachAiContext> {
  const payload = foldRetiredAnswers(raw);
  const patch: Partial<CoachAiContext> = {};
  const superpowers = textValue(payload.proof.superpowers);
  if (superpowers) patch.superpowers = superpowers;

  const uniqueness = textValue(payload.proof.uniqueness);
  const problems = listValue(payload.proof.problems_asked);
  const framingBits = [
    uniqueness ? `Unique because: ${uniqueness}` : "",
    problems.length ? `Problems they solve: ${problems.join("; ")}` : "",
  ].filter(Boolean);
  if (framingBits.length) patch.proof_framing = framingBits.join("\n");

  const results = formatCareerStories(payload);
  if (results.length) patch.client_results = results;

  const industries = [
    ...listValue(payload.market.industries_credibility),
    ...listValue(payload.market.industries_worked),
  ];
  const uniqueIndustries = Array.from(new Set(industries));
  // Your Ideal Client page. The industries line stays first: tools read it as the niche.
  const ideal = [
    uniqueIndustries.length ? uniqueIndustries.slice(0, 4).join(", ") : "",
    listValue(payload.market.buyer_roles).length ? `Who signs off: ${listValue(payload.market.buyer_roles).join(", ")}` : "",
    listValue(payload.client.characteristics).length ? `Who they are: ${listValue(payload.client.characteristics).join("; ")}` : "",
  ].filter(Boolean);
  if (ideal.length) patch.ideal_client = ideal.join("\n");

  const pains = listValue(payload.client.pains_now);
  if (pains.length) patch.pain_language = pains.join("\n");

  const says = listValue(payload.client.says);
  const avoid = listValue(payload.client.words_avoid);
  if (says.length || avoid.length) {
    patch.industry_vocabulary = [says.join("\n"), avoid.length ? `Avoid: ${avoid.join(", ")}` : ""].filter(Boolean).join("\n");
  }

  const hooks = [...listValue(payload.client.buying_triggers), textValue(payload.client.why_you)].filter(Boolean);
  if (hooks.length) patch.messaging_hooks = hooks.join("\n");

  return patch;
}

export function mergePracticeIntoBrain(
  prev: CoachAiContext,
  payload: PracticeKnowledgePayload
): CoachAiContext {
  return mergeCoachAiContext(prev, brainPatchFromPractice(payload));
}
