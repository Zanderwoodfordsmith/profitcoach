import type { InterviewTurn, PracticeKnowledgePayload } from "./types";
import { listValue, textValue } from "./sourced";

export const PRACTICE_INTERVIEW_SYSTEM = `You are the Practice Installation interviewer for Business Coach Academy / Profit Coach.

Your job is a short conversation (20 minutes or less) that fills the coach's Practice Blueprint: the facts we need to write their avatar, pain points, LinkedIn profile, campaigns, follow-ups, newsletters and sales script. You are not teaching. You are collecting proof and decisions.

You get a list called "Still open". Work through it in order. It is the agenda.

Rules:
- Ask ONE question at a time.
- Never invent numbers, companies, or results.
- If they give a vague result ("we grew a lot", "big turnaround"), ask for the number twice. If they still cannot give one, mark that result precise=false and move on.
- Prefer career proof OR client proof — they only need one path.
- Do not ask "who is your ideal client?". Ask which industries they understand, have credibility in, and can access.
- Do not re-ask facts already filled in Current knowledge unless they contradict LinkedIn.
- Stay warm, direct, and short. UK English.
- Proof first (results, superpowers, problems solved), then the market, then the practical setup (call times, web address, email, LinkedIn public or discreet, fee).
- Accept short answers for practical items. Do not push twice on those.
- If the coach says they do not know yet, record nothing for that item and move on.
- When "Still open" is empty, or the coach wants to stop, thank them, tell them what we will now write for them, and set done=true. Do not drag it out.

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
      "client_results": { "value": [{ "id": "c1", "title": "short name", "story": "what changed, with numbers" }], "source": "interview", "updated_at": "ISO" },
      "proudest": { "value": [], "source": "interview", "updated_at": "ISO" }
    },
    "market": {
      "industries_understand": { "value": [], "source": "interview", "updated_at": "ISO" },
      "industries_credibility": { "value": [], "source": "interview", "updated_at": "ISO" },
      "industries_access": { "value": [], "source": "interview", "updated_at": "ISO" },
      "avoid": { "value": [], "source": "interview", "updated_at": "ISO" },
      "buyer_roles": { "value": [], "source": "interview", "updated_at": "ISO" },
      "geography_pref": { "value": "national", "source": "interview", "updated_at": "ISO" }
    },
    "working_times": {
      "hours_per_week": { "value": "5_10_hours_week", "source": "interview", "updated_at": "ISO" },
      "preferred_hours": { "value": "client session days and times", "source": "interview", "updated_at": "ISO" },
      "prospect_call_hours": { "value": "", "source": "interview", "updated_at": "ISO" }
    },
    "identity": {
      "phone": { "value": "", "source": "interview", "updated_at": "ISO" },
      "web_address": { "value": "own domain: example.com | Profit Coach page", "source": "interview", "updated_at": "ISO" },
      "practice_email": { "value": "own address: name@example.com | set one up", "source": "interview", "updated_at": "ISO" },
      "linkedin_visibility": { "value": "public", "source": "interview", "updated_at": "ISO" }
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
geography_pref must be local, national, or international.
linkedin_visibility must be public or discreet.`;

export function summarizeKnowledgeForPrompt(
  payload: PracticeKnowledgePayload
): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value) lines.push(`${label}: ${value}`);
  };
  push("LinkedIn", textValue(payload.identity.linkedin_url));
  push("Location", textValue(payload.identity.location));
  push("Phone", textValue(payload.identity.phone) ? "on file" : "");
  push("Current website", textValue(payload.identity.website));
  push("Web address choice", textValue(payload.identity.web_address));
  push("Practice email choice", textValue(payload.identity.practice_email));
  push("LinkedIn visibility", payload.identity.linkedin_visibility?.value ?? "");
  push("Hours/week", textValue(payload.working_times.hours_per_week));
  push("Client call times", textValue(payload.working_times.preferred_hours));
  push("Prospect call times", textValue(payload.working_times.prospect_call_hours));
  push("Delivery model", payload.practice.delivery_model?.value ?? "");
  push("Minimum fee", textValue(payload.practice.min_fee));
  push("Capacity", textValue(payload.practice.capacity));
  push("Roles", listValue(payload.market.roles_held).join(", "));
  push("Industries worked", listValue(payload.market.industries_worked).join(", "));
  push("Credibility in", listValue(payload.market.industries_credibility).join(", "));
  push("Understands", listValue(payload.market.industries_understand).join(", "));
  push("Can access", listValue(payload.market.industries_access).join(", "));
  push("Who signs off", listValue(payload.market.buyer_roles).join(", "));
  push("Will not take", listValue(payload.market.avoid).join(", "));
  push("Geography", payload.market.geography_pref?.value ?? "");
  const results = payload.proof.career_results?.value ?? [];
  if (results.length) {
    lines.push("Career results:");
    for (const r of results) {
      lines.push(
        `- ${[r.role, r.company].filter(Boolean).join(" at ")}: ${r.metric_from || "?"} to ${r.metric_to || "?"} in ${r.timeframe || "?"}${r.mechanism ? ` by ${r.mechanism}` : ""} (${r.precise ? "precise" : "needs a number"})`
      );
    }
  }
  const stories = payload.proof.client_results?.value ?? [];
  if (stories.length) {
    lines.push("Client stories:");
    for (const c of stories) lines.push(`- ${c.title}: ${c.story}`);
  }
  push("Superpowers", textValue(payload.proof.superpowers));
  push("Uniqueness", textValue(payload.proof.uniqueness));
  push("Problems asked", listValue(payload.proof.problems_asked).join("; "));
  push("Proudest", listValue(payload.proof.proudest).join("; "));
  push("Evidence notes", textValue(payload.proof.evidence_notes));
  return lines.join("\n") || "(empty)";
}

export function buildInterviewUser(opts: {
  linkedinSummary: string;
  knowledge: PracticeKnowledgePayload;
  turns: InterviewTurn[];
  userMessage: string | null;
  /** Open blueprint fields, in document order, with how to ask each one. */
  stillOpen?: { label: string; ask: string }[];
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
    "## Still open (the agenda, in order)",
    opts.stillOpen?.length
      ? opts.stillOpen.map((q, i) => `${i + 1}. ${q.label}. Ask: ${q.ask}`).join("\n")
      : "(nothing left: wrap up and set done=true)",
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
