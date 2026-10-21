import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { listValue, textValue } from "@/lib/practiceKnowledge/sourced";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** What the sales call needs from the coach's Blueprint. Proof comes only from here. */
export type SalesCallCoach = {
  name: string;
  /** Price and terms as the coach quotes them, or "" before it is set. */
  price: string;
  /** Their learnable pitch from the Blueprint (Your personalised pitch), as markdown. */
  pitch: string;
  /** Real results only, one per line. */
  proof: string[];
  /** How they want to be known and the kind of coach they are. */
  voice: string;
  /** Their guarantee in their words, or "" for none. */
  guarantee: string;
  /** How they run sessions, or "" for the BCA format. Used by the phased pitch. */
  rhythm: string;
  /** What they help owners with, one per line. */
  helpWith: string[];
  /** How soon a client sees a first result, or "" when they'd rather not say. */
  timeframe: string;
};

export async function loadSalesCallCoach(coachId: string): Promise<SalesCallCoach> {
  const [row, { data: profile }] = await Promise.all([
    findPracticeKnowledge(coachId),
    supabaseAdmin.from("profiles").select("full_name").eq("id", coachId).maybeSingle(),
  ]);
  const payload = row?.payload;
  const career = (payload?.proof.career_results?.value ?? [])
    .map((r) => {
      const change = r.metric_from && r.metric_to ? `from ${r.metric_from} to ${r.metric_to}` : r.metric_to || r.metric_from;
      return [change, r.timeframe && `in ${r.timeframe}`, r.role && `as ${r.role}`, r.company && `at ${r.company}`]
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean);
  const stories = (payload?.proof.client_results?.value ?? [])
    .map((s) => [s.title, s.story].filter(Boolean).join(": "))
    .filter(Boolean);
  const script = row?.built_sections["sales:script"]?.blocks;
  return {
    name: String((profile as { full_name?: string | null } | null)?.full_name ?? "").trim(),
    price: textValue(payload?.practice.min_fee),
    pitch: script?.length ? blocksToMarkdown(script, 3) : "",
    proof: [...career, ...stories],
    voice: [textValue(payload?.practice.voice_known_for), textValue(payload?.practice.voice_coaching_style)]
      .filter(Boolean)
      .join("\n"),
    guarantee: textValue(payload?.practice.guarantee_terms),
    rhythm: textValue(payload?.practice.session_rhythm),
    helpWith: listValue(payload?.practice.help_with),
    timeframe: textValue(payload?.practice.offer_timeframe),
  };
}
