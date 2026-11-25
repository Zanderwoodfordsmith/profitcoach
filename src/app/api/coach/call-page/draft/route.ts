import { NextResponse } from "next/server";
import { resolveReference } from "@/lib/agent/context";
import { defaultCallPage, parseCallPage, type CallPageContent } from "@/lib/callPage/content";
import { callPageEditor } from "@/lib/callPage/editor";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadBlueprintContext } from "@/lib/practiceKnowledge/blueprintContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 300;

/**
 * Ava drafts the coach's first-call page from their Blueprint. Returns the words;
 * the page saves them like any other edit.
 */
export async function POST(request: Request) {
  const ed = await callPageEditor(request);
  if ("error" in ed) return NextResponse.json({ error: ed.error }, { status: ed.status });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, first_name, directory_summary, directory_bio")
    .eq("id", ed.coach.id)
    .maybeSingle();
  const fullName = (profile?.full_name as string | null)?.trim() || ed.coach.displayName;
  const firstName = (profile?.first_name as string | null)?.trim() || fullName.split(/\s+/)[0];
  const facts = {
    firstName,
    callName: ed.calendar.name,
    minutes: ed.calendar.meeting_duration_minutes,
  };

  const blueprint = await loadBlueprintContext(ed.coach.id);
  const rules = resolveReference("ai-knowledge/writing-rules.md")?.text ?? "";
  const shape = defaultCallPage(facts);

  const system = `You write the page a business coach sends owners to book their first call, the ${facts.callName}.
The page is in the coach's own voice ("I"), speaking to a UK owner-led business owner.

Write from the coach's Blueprint: their ideal client, the pains they hear, their method, their story and real results.
Keep the structure and length of the example JSON. Every field is plain text; use a blank line between paragraphs in "body" fields.
- hero: the promise of the call in a two-part heading (light then strong), and a lede of 2 to 3 sentences.
- why: why the owner's effort so far hasn't fixed it, in the coach's terms. 3 short paragraphs.
- book: a two-part heading about the call, one line on the cost of waiting, 3 short promises (first one names the coach).
- done: what's already worked out before the call, and 3 things they leave with.
- agenda: the 4 steps of the ${facts.minutes} minutes.
- about: why talk to this coach: their background and who they've helped, 2 short paragraphs; "proof" is one real result from the Blueprint with numbers, or "" if there isn't one. Never invent results, clients, names or numbers.
- fit: 4 lines on who it's for (match the Blueprint's ideal client) and 3 on who it isn't for.
- faq: 4 questions an owner asks before booking, with short answers.

Writing rules (binding):
${rules}

Reply with JSON only, the same shape as the example.`;

  const user = `Coach: ${fullName}
Call: ${facts.callName}, ${facts.minutes} minutes, free, one to one.
Directory line: ${(profile?.directory_summary as string | null) ?? ""}
Directory bio: ${(profile?.directory_bio as string | null) ?? ""}

Blueprint:
${blueprint || "(Blueprint is mostly empty; keep close to the example and leave about.proof empty.)"}

Example JSON (shape and length to follow):
${JSON.stringify(shape, null, 2)}`;

  const { data, error } = await generateCampaignJson<CallPageContent>({
    system,
    user,
    maxTokens: 6000,
    writing: true,
  });
  if (!data) {
    return NextResponse.json({ error: error || "Ava could not draft the page. Try again." }, { status: 502 });
  }
  return NextResponse.json({ content: parseCallPage(data, facts) });
}
