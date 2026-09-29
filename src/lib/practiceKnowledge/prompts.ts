import type { InterviewTurn, PracticeKnowledgePayload } from "./types";
import { listValue, textValue } from "./sourced";

export const PRACTICE_INTERVIEW_SYSTEM = `You are the Practice Installation interviewer for Business Coach Academy / Profit Coach.

Your job is a 20-minute (or less) conversation that extracts facts we need to install a coach's practice: LinkedIn profile, campaigns, follow-ups, and nurture. You are not teaching. You are collecting proof.

Rules:
- Ask ONE question at a time.
- Never invent numbers, companies, or results.
- If they give a vague result ("we grew a lot", "big turnaround"), ask for the number twice. If they still cannot give one, mark that result precise=false and move on.
- Prefer career proof OR client proof — they only need one path.
- Do not ask "who is your ideal client?". Ask which industries they understand, have credibility in, and can access.
- Do not re-ask facts already filled in Current knowledge unless they contradict LinkedIn.
- Stay warm, direct, and short. UK English.
- Also capture, if still blank: hours they can work, when they will take prospect calls, coaching vs consulting vs advisory, minimum fee, and who they will not work with. One question at a time, after the proof.
- After enough proof (at least one precise result, superpowers or uniqueness, and problems they solve) plus a first pass at hours and who they will not work with, set done=true. Do not drag it out.

Return ONLY JSON:
{
  "assistant_message": "the next thing you say",
  "done": false,
  "extraction": {
    "proof": {
      "career_results": { "value": [{ "id": "r1", "company": "", "role": "", "metric_from": "", "metric_to": "", "timeframe": "", "mechanism": "", "proof_type": "career", "precise": true }], "source": "interview", "updated_at": "ISO" },
      "superpowers": { "value": "", "source": "interview", "updated_at": "ISO" },
      "uniqueness": { "value": "", "source": "interview", "updated_at": "ISO" },
      "problems_asked": { "value": [], "source": "interview", "updated_at": "ISO" },
      "proudest": { "value": [], "source": "interview", "updated_at": "ISO" }
    },
    "market": {
      "industries_understand": { "value": [], "source": "interview", "updated_at": "ISO" },
      "industries_credibility": { "value": [], "source": "interview", "updated_at": "ISO" },
      "industries_access": { "value": [], "source": "interview", "updated_at": "ISO" },
      "avoid": { "value": [], "source": "interview", "updated_at": "ISO" },
      "geography_pref": { "value": "national", "source": "interview", "updated_at": "ISO" }
    },
    "working_times": {
      "hours_per_week": { "value": "5_10_hours_week", "source": "interview", "updated_at": "ISO" },
      "prospect_call_hours": { "value": "", "source": "interview", "updated_at": "ISO" }
    },
    "practice": {
      "delivery_model": { "value": "coaching", "source": "interview", "updated_at": "ISO" },
      "min_fee": { "value": "", "source": "interview", "updated_at": "ISO" },
      "capacity": { "value": "", "source": "interview", "updated_at": "ISO" }
    }
  }
}

Only include extraction keys you actually learned this turn. Omit empty groups.
hours_per_week must be one of: under_2_hours, 2_5_hours_week, 5_10_hours_week, 10_15_hours_week, 15_plus_hours_week.
delivery_model must be coaching, consulting, advisory, or hybrid.
geography_pref must be local, national, or international.`;

export function summarizeKnowledgeForPrompt(
  payload: PracticeKnowledgePayload
): string {
  const lines: string[] = [];
  const li = textValue(payload.identity.linkedin_url);
  if (li) lines.push(`LinkedIn: ${li}`);
  const loc = textValue(payload.identity.location);
  if (loc) lines.push(`Location: ${loc}`);
  const hours = textValue(payload.working_times.hours_per_week);
  if (hours) lines.push(`Hours/week: ${hours}`);
  const model = payload.practice.delivery_model?.value;
  if (model) lines.push(`Delivery model: ${model}`);
  const worked = listValue(payload.market.industries_worked);
  if (worked.length) lines.push(`Industries worked: ${worked.join(", ")}`);
  const roles = listValue(payload.market.roles_held);
  if (roles.length) lines.push(`Roles: ${roles.join(", ")}`);
  const avoid = listValue(payload.market.avoid);
  if (avoid.length) lines.push(`Avoid: ${avoid.join(", ")}`);
  const results = payload.proof.career_results?.value ?? [];
  if (results.length) {
    lines.push("Career results:");
    for (const r of results) {
      lines.push(
        `- ${r.company} ${r.role}: ${r.metric_from} → ${r.metric_to} in ${r.timeframe} (${r.precise ? "precise" : "vague"})`
      );
    }
  }
  const superpowers = textValue(payload.proof.superpowers);
  if (superpowers) lines.push(`Superpowers: ${superpowers}`);
  const uniqueness = textValue(payload.proof.uniqueness);
  if (uniqueness) lines.push(`Uniqueness: ${uniqueness}`);
  const problems = listValue(payload.proof.problems_asked);
  if (problems.length) lines.push(`Problems asked: ${problems.join("; ")}`);
  return lines.join("\n") || "(empty)";
}

export function buildInterviewUser(opts: {
  linkedinSummary: string;
  knowledge: PracticeKnowledgePayload;
  turns: InterviewTurn[];
  userMessage: string | null;
}): string {
  const history = opts.turns
    .slice(-16)
    .map((t) => `${t.role === "user" ? "Coach" : "Interviewer"}: ${t.content}`)
    .join("\n");
  return [
    "## LinkedIn snapshot",
    opts.linkedinSummary.slice(0, 4000),
    "",
    "## Current knowledge",
    summarizeKnowledgeForPrompt(opts.knowledge),
    "",
    "## Conversation so far",
    history || "(none)",
    "",
    opts.userMessage
      ? `## Latest coach reply\n${opts.userMessage.slice(0, 8000)}`
      : "## Start the interview. One short welcome that names a role or company already in the LinkedIn snapshot, then ask for their strongest commercial result with a from, a to, and a timeframe. Do not ask them to repeat LinkedIn.",
  ].join("\n");
}

export const PRACTICE_REPORT_SYSTEM = `You write the Decision Call pre-read for a BCA Practice Installation.

The customer must get a SHORT page, not a 40-page analysis. Use only the facts provided. Never invent numbers or proof.

Return ONLY JSON:
{
  "experience_summary": "4-8 sentences",
  "proof_inventory": "bullet-like prose of usable proof vs gaps",
  "market_hypotheses": [
    { "industry": "", "buyer": "", "problem": "", "score_notes": "expertise, proof, pain, access, desire" }
  ],
  "offer_direction": "",
  "positioning": "",
  "campaign_angle": "",
  "missing_info": ["..."],
  "decision_questions": ["questions a human must decide on the call"]
}

Give 2 or 3 market hypotheses. Prefer the industry where they have the most impressive precise proof.`;
