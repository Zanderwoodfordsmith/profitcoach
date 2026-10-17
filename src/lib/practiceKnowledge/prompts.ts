import type { InterviewTurn, PracticeKnowledgePayload } from "./types";
import { hoursLabel } from "./brief";
import { foldRetiredAnswers, listValue, textValue } from "./sourced";
import { asVoiceTone, toneInstructions } from "./voiceTone";

export const PRACTICE_INTERVIEW_SYSTEM = `You are the Practice Installation interviewer for Business Coach Academy / Profit Coach.

Your job is a short conversation (20 minutes or less) that fills the coach's Practice Blueprint: the facts we need to write their avatar, pain points, LinkedIn profile, campaigns, follow-ups, newsletters and sales script. You are not teaching. You are collecting proof and decisions.

You get a list called "Still open". Work through it in order. It is the agenda.

Rules:
- Ask ONE question at a time.
- Never invent numbers, companies, or results.
- If they give a vague result ("we grew a lot", "big turnaround"), ask for the number twice. If they still cannot give one, mark that result precise=false and move on.
- Prefer career proof OR client proof — they only need one path.
- Do not ask a vague "who is your ideal client?". Ask the specific Still open question: the industries first, then the person (who they are, what hurts and what they want, what they say and think, what makes them act, and why the coach).
- Do not re-ask facts already filled in Current knowledge unless they contradict LinkedIn.
- Stay warm, direct, and short. UK English.
- Never use the em dash character. Use a comma or a full stop.
- Acknowledge an answer in a few words at most, then ask the next thing.
- Proof first (results, superpowers, problems solved), then the market, then the practical setup (phone, LinkedIn public or discreet, fee). Call hours, website, email and time zone are set on the Practice Setup page, not in this conversation.
- Accept short answers for practical items. Do not push twice on those.
- If the coach says they do not know yet, record nothing for that item and move on.
- When the proof is in (one result with numbers, or a client story, plus what they are known for, and the problems people already ask them to solve) and they want to stop, or when "Still open" is empty, close. Thank them in one line. Say BCA will draft two or three markets and a campaign angle for them to read, and their next step is to book the Blueprint Call with Pam to lock one market, one offer, and one angle. Set done=true. Do not draft the LinkedIn profile, the campaigns, or the script on this call.

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
    "client": {
      "characteristics": { "value": ["one line each, strongest first"], "source": "interview", "updated_at": "ISO" },
      "pains_now": { "value": ["what hurts now, and what happens if they leave it"], "source": "interview", "updated_at": "ISO" },
      "desires_now": { "value": [], "source": "interview", "updated_at": "ISO" },
      "says": { "value": ["what they say, think, and keep hearing, in their words"], "source": "interview", "updated_at": "ISO" },
      "words_avoid": { "value": [], "source": "interview", "updated_at": "ISO" },
      "buying_triggers": { "value": [], "source": "interview", "updated_at": "ISO" },
      "objections": { "value": [], "source": "interview", "updated_at": "ISO" },
      "why_you": { "value": "", "source": "interview", "updated_at": "ISO" }
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
      "capacity": { "value": "", "source": "interview", "updated_at": "ISO" },
      "payment_terms": { "value": "monthly, 6-month minimum | 6 months upfront", "source": "interview", "updated_at": "ISO" },
      "guarantee": { "value": "none", "source": "interview", "updated_at": "ISO" },
      "guarantee_terms": { "value": "", "source": "interview", "updated_at": "ISO" },
      "offer_outcome": { "value": "money", "source": "interview", "updated_at": "ISO" },
      "more_of": { "value": [], "source": "interview", "updated_at": "ISO" },
      "less_of": { "value": [], "source": "interview", "updated_at": "ISO" },
      "help_with": { "value": [], "source": "interview", "updated_at": "ISO" },
      "offer_timeframe": { "value": "", "source": "interview", "updated_at": "ISO" },
      "tone": { "value": { "respect": 3, "humour": 3, "formality": 3, "energy": 3, "confidence": 3 }, "source": "interview", "updated_at": "ISO" },
      "voice_sounds_like": { "value": "", "source": "interview", "updated_at": "ISO" },
      "voice_never": { "value": "", "source": "interview", "updated_at": "ISO" },
      "voice_known_for": { "value": "", "source": "interview", "updated_at": "ISO" },
      "voice_coaching_style": { "value": "", "source": "interview", "updated_at": "ISO" },
      "voice_values": { "value": [], "source": "interview", "updated_at": "ISO" },
      "voice_qualities": { "value": [], "source": "interview", "updated_at": "ISO" },
      "voice_like_in_people": { "value": [], "source": "interview", "updated_at": "ISO" },
      "voice_dislike_in_people": { "value": [], "source": "interview", "updated_at": "ISO" },
      "voice_pet_peeves": { "value": [], "source": "interview", "updated_at": "ISO" },
      "voice_favourite_book": { "value": "", "source": "interview", "updated_at": "ISO" },
      "voice_favourite_film": { "value": "", "source": "interview", "updated_at": "ISO" },
      "voice_hobbies": { "value": [], "source": "interview", "updated_at": "ISO" },
      "voice_stories": { "value": "", "source": "interview", "updated_at": "ISO" }
    }
  }
}

Only include extraction keys you actually learned this turn. Omit empty groups.
hours_per_week must be one of: under_2_hours, 2_5_hours_week, 5_10_hours_week, 10_15_hours_week, 15_plus_hours_week.
delivery_model must be coaching, consulting, advisory, or hybrid.
geography_pref must be local, national, or international.
linkedin_visibility must be public or discreet.
guarantee must be none, trial (they can stop after a first period) or results (a promise tied to doing the work). Never suggest guaranteeing income.
offer_outcome must be money, time, or team (the BOSS score destination this offer leads with).
more_of and less_of are short lists (two to five lines) of the destination in their words. Strongest first. Not essays.
help_with is a short list of what they actually help owners with, in their words.
tone is how the coach comes across, judged from how they write and talk in this conversation. Never ask about it. Each slider is 1 to 5: respect (1 very respectful, 5 irreverent), humour (1 serious, 5 playful), formality (1 formal, 5 casual), energy (1 matter-of-fact, 5 enthusiastic), confidence (1 modest, 5 bold). Set it once, after the coach has written a few replies, and only if "Tone" is not already in Current knowledge.
Voice authenticity questions (how they want to be known, the kind of coach they are, values, pet peeves, favourite book and film, hobbies, a story) can seem an odd ask. Say so once, then ask anyway: we need them so marketing sounds like the coach, not like BCA. Ask the Still open wording.`;

/**
 * The coach's answers as prompt lines. With `only`, just those answers (a
 * writer's contract); without it, everything.
 */
export function summarizeKnowledgeForPrompt(
  raw: PracticeKnowledgePayload,
  only?: ReadonlySet<string>
): string {
  const payload = foldRetiredAnswers(raw);
  const lines: string[] = [];
  const wanted = (path: string) => !only || only.has(path);
  const push = (path: string, label: string, value: string) => {
    if (value && wanted(path)) lines.push(`${label}: ${value}`);
  };
  push("identity.linkedin_url", "LinkedIn", textValue(payload.identity.linkedin_url));
  push("identity.location", "Location", textValue(payload.identity.location));
  push("identity.timezone", "Time zone", textValue(payload.identity.timezone));
  push("identity.phone", "Phone", textValue(payload.identity.phone) ? "on file" : "");
  push("identity.website", "Current website", textValue(payload.identity.website));
  push("identity.web_address", "Web address choice", textValue(payload.identity.web_address));
  push("identity.practice_email", "Practice email choice", textValue(payload.identity.practice_email));
  push("identity.linkedin_visibility", "LinkedIn visibility", payload.identity.linkedin_visibility?.value ?? "");
  const hours = textValue(payload.working_times.hours_per_week);
  push("working_times.hours_per_week", "Time available for the practice (not years of experience)", hours ? hoursLabel(hours) : "");
  push("working_times.preferred_hours", "Client call times", textValue(payload.working_times.preferred_hours));
  push("working_times.prospect_call_hours", "Prospect call times", textValue(payload.working_times.prospect_call_hours));
  push("practice.delivery_model", "Delivery model", payload.practice.delivery_model?.value ?? "");
  push("practice.delivery_format", "One-to-one or group", payload.practice.delivery_format?.value ?? "");
  push("practice.min_fee", "Minimum fee", textValue(payload.practice.min_fee));
  push("practice.capacity", "Capacity", textValue(payload.practice.capacity));
  push("practice.payment_terms", "Payment terms", textValue(payload.practice.payment_terms));
  const guarantee = payload.practice.guarantee?.value;
  push(
    "practice.guarantee",
    "Guarantee",
    guarantee === "none"
      ? "none"
      : [guarantee === "trial" ? "trial period" : guarantee === "results" ? "results-based" : "", textValue(payload.practice.guarantee_terms)]
          .filter(Boolean)
          .join(": ")
  );
  push("practice.session_rhythm", "Session rhythm", textValue(payload.practice.session_rhythm));
  push(
    "practice.offer_outcome",
    "Offer leads with",
    payload.practice.offer_outcome?.value === "money"
      ? "money"
      : payload.practice.offer_outcome?.value === "time"
        ? "time"
        : payload.practice.offer_outcome?.value === "team"
          ? "team"
          : ""
  );
  push("practice.more_of", "They get more of", listValue(payload.practice.more_of).join("; "));
  push("practice.less_of", "They get less of", listValue(payload.practice.less_of).join("; "));
  push("practice.help_with", "What they help with", listValue(payload.practice.help_with).join("; "));
  push("practice.offer_timeframe", "First result they can point to", textValue(payload.practice.offer_timeframe));
  push("identity.linkedin_headline", "LinkedIn headline today", textValue(payload.identity.linkedin_headline));
  push("market.roles_held", "Roles", listValue(payload.market.roles_held).join(", "));
  push("market.industries_worked", "Industries worked", listValue(payload.market.industries_worked).join(", "));
  push("market.industries_credibility", "Credibility in", listValue(payload.market.industries_credibility).join(", "));
  push("market.buyer_roles", "Who signs off", listValue(payload.market.buyer_roles).join(", "));
  push("market.avoid", "Will not take", listValue(payload.market.avoid).join(", "));
  push("market.geography_pref", "Geography", payload.market.geography_pref?.value ?? "");
  push("client.characteristics", "Ideal client, who they are", listValue(payload.client.characteristics).join("; "));
  push("client.pains_now", "Less of", listValue(payload.client.pains_now).join("; "));
  push("client.desires_now", "More of", listValue(payload.client.desires_now).join("; "));
  push("client.says", "What they say and think", listValue(payload.client.says).join("; "));
  push("client.words_avoid", "Words to avoid", listValue(payload.client.words_avoid).join("; "));
  push("client.buying_triggers", "The moment they act", listValue(payload.client.buying_triggers).join("; "));
  push("client.objections", "Objections", listValue(payload.client.objections).join("; "));
  push("client.why_you", "Why you", textValue(payload.client.why_you));
  const tone = asVoiceTone(payload.practice.tone?.value);
  if (tone && wanted("practice.tone")) {
    lines.push("Tone (write to this):");
    for (const line of toneInstructions(tone)) lines.push(`- ${line}`);
  }
  push("practice.voice_sounds_like", "Sounds like (their own example)", textValue(payload.practice.voice_sounds_like));
  push("practice.voice_never", "Never sounds like", textValue(payload.practice.voice_never));
  push("practice.voice_notes", "More on their voice", textValue(payload.practice.voice_notes));
  push("practice.voice_known_for", "How they want to be known", textValue(payload.practice.voice_known_for));
  push("practice.voice_coaching_style", "The kind of coach they are", textValue(payload.practice.voice_coaching_style));
  push("practice.voice_values", "Values that matter", listValue(payload.practice.voice_values).join("; "));
  push("practice.voice_qualities", "Qualities that matter", listValue(payload.practice.voice_qualities).join("; "));
  push("practice.voice_like_in_people", "What they like in a person", listValue(payload.practice.voice_like_in_people).join("; "));
  push("practice.voice_dislike_in_people", "What they do not like in a person", listValue(payload.practice.voice_dislike_in_people).join("; "));
  push("practice.voice_pet_peeves", "Pet peeves", listValue(payload.practice.voice_pet_peeves).join("; "));
  push("practice.voice_favourite_book", "Favourite book", textValue(payload.practice.voice_favourite_book));
  push("practice.voice_favourite_film", "Favourite film", textValue(payload.practice.voice_favourite_film));
  push("practice.voice_hobbies", "Hobbies and sports", listValue(payload.practice.voice_hobbies).join("; "));
  push("practice.voice_stories", "A story they would share", textValue(payload.practice.voice_stories));
  const results = payload.proof.career_results?.value ?? [];
  if (results.length && wanted("proof.career_results")) {
    lines.push("Career results:");
    for (const r of results) {
      lines.push(
        `- ${[r.role, r.company].filter(Boolean).join(" at ")}: ${r.metric_from || "?"} to ${r.metric_to || "?"} in ${r.timeframe || "?"}${r.mechanism ? ` by ${r.mechanism}` : ""} (${r.precise ? "precise" : "needs a number"})`
      );
    }
  }
  const stories = payload.proof.client_results?.value ?? [];
  if (stories.length && wanted("proof.client_results")) {
    lines.push("Client stories:");
    for (const c of stories) lines.push(`- ${c.title}: ${c.story}`);
  }
  push("proof.superpowers", "Superpowers", textValue(payload.proof.superpowers));
  push("proof.uniqueness", "Uniqueness", textValue(payload.proof.uniqueness));
  push("proof.problems_asked", "Problems asked", listValue(payload.proof.problems_asked).join("; "));
  push("proof.proudest", "Proudest", listValue(payload.proof.proudest).join("; "));
  push("proof.evidence_notes", "Evidence notes", textValue(payload.proof.evidence_notes));
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
      ? `## Latest coach reply\n${opts.userMessage.slice(0, 8000)}\n\nReply with ONE JSON object with exactly these keys: "assistant_message" (what you say next), "done" (true or false), "extraction" (what you learned from this reply).`
      : "## Start the interview. One short welcome that names a role or company already in the LinkedIn snapshot (or already in Current knowledge), then ask the FIRST item on the Still open list. Always end with a question. Do not ask them to repeat LinkedIn.",
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
