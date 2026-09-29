import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import { mergeCoachAiContext } from "@/lib/profitCoachAi/loadCoachPromptContext";
import type { PracticeKnowledgePayload } from "./types";
import { listValue, textValue } from "./sourced";

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
  payload: PracticeKnowledgePayload
): Partial<CoachAiContext> {
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
    ...listValue(payload.market.industries_understand),
    ...listValue(payload.market.industries_credibility),
    ...listValue(payload.market.industries_worked),
  ];
  const uniqueIndustries = Array.from(new Set(industries));
  if (uniqueIndustries.length) {
    patch.ideal_client = uniqueIndustries.slice(0, 4).join(", ");
  }

  return patch;
}

export function mergePracticeIntoBrain(
  prev: CoachAiContext,
  payload: PracticeKnowledgePayload
): CoachAiContext {
  return mergeCoachAiContext(prev, brainPatchFromPractice(payload));
}
