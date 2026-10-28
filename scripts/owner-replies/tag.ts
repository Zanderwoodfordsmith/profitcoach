/**
 * Owner replies analysis, step 2: tag each conversation (who replied, pains, objections) and each
 * campaign message (angle, offer, proof) with Haiku. Read-only on the database; reads and writes JSON
 * files in the folder given.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/owner-replies/tag.ts <dir>
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { quoteIsExact } from "@/lib/research/marketPains";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && l.slice(0, i).trim() === "ANTHROPIC_API_KEY") process.env.ANTHROPIC_API_KEY = l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const DIR = process.argv[2];
const MODEL = "claude-haiku-5-5";
const PRICE: [number, number] = [0.1, 0.5];
const CAP_USD = 8;
const client = new Anthropic({ maxRetries: 4 });
let tokensIn = 0;
let tokensOut = 0;
const spent = () => (tokensIn * PRICE[0] + tokensOut * PRICE[1]) / 1_000_000;

async function askJson<T>(system: string, user: string, schema: Record<string, unknown>, maxTokens = 2000): Promise<T | null> {
  if (spent() > CAP_USD) throw new Error(`Cost cap reached ($${spent().toFixed(2)}).`);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: user }],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);
  tokensIn += response.usage.input_tokens;
  tokensOut += response.usage.output_tokens;
  if (response.stop_reason !== "end_turn") return null;
  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = await fn(items[i], i);
        } catch (e) {
          if (String(e).includes("Cost cap")) throw e;
          out[i] = null as R;
        }
        if (i % 200 === 0) console.log(`${i}/${items.length} $${spent().toFixed(3)}`);
      }
    })
  );
  return out;
}

const CONV_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["speaker", "industry_guess", "size_hint", "reply_kind", "pains", "objections", "reacted_to"],
  properties: {
    speaker: { type: "string", enum: ["owner_or_md", "director_or_partner", "senior_employee", "employee", "recruiter", "vendor_or_salesperson", "coach_or_consultant", "friend_or_personal", "automated", "unclear"] },
    industry_guess: { type: "string" },
    size_hint: { type: "string" },
    reply_kind: { type: "string", enum: ["interested", "open_question", "soft_maybe", "not_now", "not_interested", "referral", "pitching_back", "pleasantry_only", "noise"] },
    pains: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["quote", "short"], properties: { quote: { type: "string" }, short: { type: "string" } } },
    },
    objections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "quote"],
        properties: {
          kind: { type: "string", enum: ["not_now_timing", "no_need_doing_fine", "already_have_adviser_or_coach", "price_or_budget", "no_time", "not_interested", "bad_experience_with_coaches", "selling_or_retiring", "too_small_or_wrong_fit", "suspicious_of_pitch", "other"] },
          quote: { type: "string" },
        },
      },
    },
    reacted_to: { type: "string" },
  },
};

const CONV_SYSTEM = `You read one reply thread between a UK business coach and a business contact. The coach's outreach is shown first if we have it, then the contact's own messages.

Decide who the contact is (speaker). owner_or_md means they own or run the business (owner, founder, managing director, CEO of their own firm). Use the job title, company and what they say.

Then pull out, ONLY from the contact's own messages:
- pains: problems, frustrations, worries or goals about running their business. "quote" must be copied EXACTLY, character for character, from the contact's messages (a sentence or part of one; never join two sentences, never fix spelling). "short" is 3 to 6 plain words naming the pain. No pains? Return [].
- objections: reasons they give for not wanting help now, each with an exact quote.
- reply_kind: the overall reply.
- reacted_to: in under 12 words, which part of the coach's message they responded to (or "unknown" if no outreach is shown).
- industry_guess: the industry in 1 to 4 words from the company name, title and text ("unknown" if you cannot tell).
- size_hint: any size signal (staff, turnover, sites) in under 8 words, else "unknown".

Ignore the coach's messages when quoting. Do not invent quotes.`;

const STEP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pain_named", "promise", "offer", "format", "proof", "proof_quote"],
  properties: {
    pain_named: { type: "string" },
    promise: { type: "string" },
    offer: { type: "string", enum: ["boss_score_or_scorecard", "call_or_chat", "free_review_or_audit", "resource_or_guide", "event_or_webinar", "newsletter", "intro_or_referral", "nothing_just_connect", "other"] },
    format: { type: "string", enum: ["question", "compliment_or_common_ground", "pain_statement", "offer_first", "proof_or_story", "plain_hello", "follow_up_nudge", "other"] },
    proof: { type: "string", enum: ["own", "bca", "none"] },
    proof_quote: { type: "string" },
  },
};

const STEP_SYSTEM = `You read one outreach message a UK business coach sends to business owners (a LinkedIn connection note, a follow-up message or an email). Placeholders like {first_name} are normal.

Return:
- pain_named: the business pain or problem the message names, in 3 to 8 plain words, or "none".
- promise: the outcome it promises, in 3 to 8 plain words, or "none".
- offer: what it asks them to take up.
- format: how it opens or what kind of message it mainly is.
- proof: "own" if it uses the coach's own proof (a result they got, a number, a named client or the industry they have worked in); "bca" if it uses collective proof from a wider group ("our coaches have helped...", "we have worked with 500 businesses", a programme or academy track record); "none" if no proof.
- proof_quote: the exact words carrying the proof, copied from the message, or "".`;

type Rec = {
  id: string; self?: boolean; business: string | null; title: string | null; industry: string | null; team_size: string | null; revenue: string | null;
  location: string | null; channel: string; replied_to_text?: string; opener?: string | null; replied_to?: string[]; inbound: string[];
};
type ConvTag = { speaker: string; industry_guess: string; size_hint: string; reply_kind: string; pains: { quote: string; short: string }[]; objections: { kind: string; quote: string }[]; reacted_to: string };
type StepTag = { pain_named: string; promise: string; offer: string; format: string; proof: string; proof_quote: string };

async function main() {
  const records: Rec[] = JSON.parse(readFileSync(join(DIR, "records.json"), "utf8"));
  const steps: { step_id: string; body: string }[] = JSON.parse(readFileSync(join(DIR, "steps.json"), "utf8"));
  const convs = records.filter((r) => !r.self && r.inbound.join(" ").trim().length >= 12);
  console.log(`${convs.length} conversations to tag, ${steps.length} campaign messages`);

  const stepOut = join(DIR, "step_tags.json");
  if (!existsSync(stepOut)) {
    const tags = await pool(steps, 12, (s) => askJson<StepTag>(STEP_SYSTEM, s.body, STEP_SCHEMA, 600));
    const out: Record<string, StepTag> = {};
    steps.forEach((s, i) => {
      const t = tags[i];
      if (!t) return;
      if (t.proof_quote && !quoteIsExact(t.proof_quote, s.body)) t.proof_quote = "";
      out[s.step_id] = t;
    });
    writeFileSync(stepOut, JSON.stringify(out));
    console.log(`steps tagged: ${Object.keys(out).length}, $${spent().toFixed(3)}`);
  }

  const convOut = join(DIR, "conv_tags.json");
  let dropped = 0;
  let kept = 0;
  const tags = await pool(convs, 16, (r) => {
    const outreach = (r.replied_to_text || (r.replied_to ?? []).join("\n---\n") || r.opener || "").slice(0, 1500);
    const user = [
      `Company: ${r.business ?? "unknown"} | Title: ${r.title ?? "unknown"} | Industry on file: ${r.industry ?? "unknown"} | Size on file: ${[r.team_size, r.revenue].filter(Boolean).join(", ") || "unknown"} | Channel: ${r.channel}`,
      outreach ? `COACH'S OUTREACH (do not quote):\n${outreach}` : "COACH'S OUTREACH: not available",
      `CONTACT'S MESSAGES (quote only from here):\n${r.inbound.map((t, i) => `[${i + 1}] ${t.slice(0, 1500)}`).join("\n\n")}`,
    ].join("\n\n");
    return askJson<ConvTag>(CONV_SYSTEM, user, CONV_SCHEMA, 1500);
  });
  const out: Record<string, ConvTag> = {};
  convs.forEach((r, i) => {
    const t = tags[i];
    if (!t) return;
    const source = r.inbound.join("\n\n");
    const check = <Q extends { quote: string }>(qs: Q[]) =>
      qs.filter((q) => {
        const ok = q.quote.trim().length >= 8 && quoteIsExact(q.quote, source);
        ok ? kept++ : dropped++;
        return ok;
      });
    t.pains = check(t.pains);
    t.objections = check(t.objections);
    out[r.id] = t;
  });
  writeFileSync(convOut, JSON.stringify(out));
  const cost = { model: MODEL, input_tokens: tokensIn, output_tokens: tokensOut, usd: Math.round(spent() * 1000) / 1000, quotes_kept: kept, quotes_dropped_not_exact: dropped, tagged: Object.keys(out).length };
  writeFileSync(join(DIR, "tag_cost.json"), JSON.stringify(cost, null, 2));
  console.log(cost);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
