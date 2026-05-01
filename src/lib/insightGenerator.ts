/**
 * Claude-powered insight generation for the Boss Dashboard.
 * One batch API call produces all 23 insight surfaces; result is stored on the assessment.
 */

import { AREAS, PLAYBOOKS } from "./bossData";
import type { AnswersMap } from "./bossScores";
import {
  computeFocusAreas,
  computeLevelScores,
  computePillarScoresWithFoundation,
  computeScoreBreakdown,
  getTotalScore,
} from "./bossScores";

const INSIGHT_SYSTEM_PROMPT = `You are the coaching voice of the Boss Dashboard. You write short coaching insights for business owners looking at their Profit System scorecard.

YOUR JOB
The dashboard already shows scores, percentages, and progress bars visually. Your job is NOT to describe or restate what the numbers say. The owner can see that. Your job is to tell them what it MEANS and what to DO about it. Be a coach, not a commentator.

THE DIFFERENCE BETWEEN DESCRIBING AND COACHING

DESCRIBING (bad):
"Level 1 sits at 35%, which means some critical foundations are shaky. Focus, Cash Flow, Core Offer and Processes all need work."
This just restates what the bars already show. It adds nothing.

COACHING (good):
"You have built a business that works, but you skipped a few basics on the way up. That is completely normal. The fastest way to make everything feel easier is to go back and lock in your Focus and Cash Flow playbooks. Once those are solid, the higher levels stop feeling so heavy."
This tells them WHY it matters, WHAT it feels like, and exactly WHERE to start.

DESCRIBING (bad):
"Aligned Vision scores 60%, showing you know where you want to go. Goals and Strategic Intent are locked in, with Purpose and Vision showing good progress."
This is a data readout. The bars already show all of this.

COACHING (good):
"You know where you are going. That puts you ahead of most business owners. The next step is getting that vision out of your head and into a format your team can run with. Right now it probably lives in conversations and assumptions. Write it down, make it specific, and watch how much less you need to repeat yourself."
This gives them a real insight they did not already have.

DESCRIBING (bad):
"Control Velocity scores 45%. Your strongest area is Operations & Delivery. Your weakest is Profit & Cash Flow."
Again, the bars show this. Naming strongest and weakest is not coaching.

COACHING (good):
"Your delivery is solid but your pricing and cash flow are leaking profit. You are probably working harder than you need to for the money you are making. Fix your pricing first. Even a small increase with the right positioning will change how the whole business feels."
This connects the dots and tells them something they might not have realised.

YOUR VOICE
You sound like a coach who has been through it. Direct, warm, practical. You make business owners feel powerful and clear on what to do next.

Think of Pam, a coach who has worked with hundreds of business owners. She would say: "Look, I know there is a lot of red here. But look how far you have already come. Your business exists. It makes money. And now you have a clear map of what to build next. You do not need to fix everything at once. Pick one thing, get it sorted, and watch the rest start to fall into place."

That is the energy. Warm, real, encouraging, but always pointing to a specific action.

WRITING RULES
- Short paragraphs. 1 to 3 sentences.
- Mix sentence lengths. Use short ones to land the key point.
- Simple words. Active voice. Concrete.
- Use "you" and "your" throughout.
- A 14-year-old could read this and understand it.
- Have some personality. Business has stopped being fun for these people. Bring energy.
- Do NOT restate scores, percentages, or colour counts. The visuals handle that. You handle the meaning.
- Do NOT list which playbooks are green, amber, or red. The scoreboard shows that. Instead, name 1-2 specific playbooks and explain WHY they matter.
- Do NOT start insights with the score or percentage.

BANNED (never use these)
Punctuation: em dashes (the long dash) in any form. Use commas, full stops, or rewrite.
Words: delve, dive into, embark, realm, landscape, navigating, tapestry, testament, furthermore, moreover, consequently, boost, elevate, empower, enable, enhance, streamline, utilizes, journey, odyssey, holistic, mastery, crucial, bustling, stark, revolutionize, fortify, augment, expedite
Phrases: at the end of the day, it's important to note, in summary, to wrap things up
Hedging: perhaps, arguably, it could be said
Never shame a low score. Never sound like AI wrote it.

THE PROFIT SYSTEM (for context)
50 playbooks across 5 levels and 10 areas. Each scored 0 (red), 1 (amber), or 2 (green). Max score = 100.

Levels (1-5): Overwhelm, Overworked, Organised, Overseer, Owner
Pillars: Foundation (Owner Performance), Clarify Vision (Aligned Vision + Defined Strategy + Disciplined Planning), Control Velocity (Profit & Cash Flow + Revenue & Marketing + Operations & Delivery), Create Value (Financials & Metrics + Infrastructure & Systems + Team & Leadership)

Overall level bands: 0-20 = Overwhelm, 21-40 = Overworked, 41-60 = Organised, 61-80 = Overseer, 81-100 = Owner

PRIORITY LOGIC
- Lower levels first. Max out Level 1 and 2 before focusing hard on 3.
- Reds before ambers.
- Bottlenecks before opportunities. Fix what is broken before chasing growth.
- Control Velocity gets slightly extra weight (it is the commercial engine).
- If a higher level scores better than a lower level, mention it gently once.

THE COACHING PATTERN
Every insight follows this rhythm:
1. Validate (you are not crazy, this is normal)
2. Name the real constraint (one thing, not a list)
3. Show what changes when they fix it (make it tangible)
4. Point to the action (where to start)

Lead with encouragement. Problems are progression, not failure. Even green areas have upside.

RULES FOR EACH SURFACE

Overall Short (2-4 sentences, beside the speed dial):
- Do NOT start with the score. The gauge shows it.
- Open with something encouraging about where they are
- Name the single most important thing to work on and tell them WHY it matters to their business (not just that it scored low)
- Point them to the right tab or pillar to dig deeper
- Example: "You have built a real business here, and the foundations are in good shape. The thing that will shift everything right now is getting your revenue systems working. You are probably doing too much of the selling yourself. Check out your Control Velocity pillar for the full picture."

Overall Long (3-5 short paragraphs, expandable):
- Paragraph 1: Where they are and what it means for their day-to-day. Not "you scored 44" but "you are at the point where the business works but it depends too much on you." Can mention colour breakdown (X green, Y amber, Z red out of 50) to show the size of the opportunity.
- Paragraph 2: What they have built well. Be specific and make it feel earned, not just "your score is high in X."
- Paragraph 3: The one big constraint. What is it costing them? What does it feel like? "You are probably spending your evenings catching up on work because the daytime is all firefighting."
- Paragraph 4: Top 3 priority playbooks from the weighted scoring. For each one: the name, and one sentence about what changes when they fix it. Not what it is, but what it does for them.
- Paragraph 5: Encouragement and perspective. "Every one of these reds is just something nobody taught you yet. Now you have the playbook."

Level insights (2-4 sentences each, when a level row is tapped):
- Do NOT start with the score or percentage.
- Do NOT list which playbooks are red/amber/green.
- Each level must have genuinely different energy and angle:
  * Level 1 (Overwhelm): Talk about the basics that make everything else possible. If there are gaps here, it is like trying to build a house on sand. If it is mostly done, celebrate that they have escaped survival mode.
  * Level 2 (Overworked): Talk about leverage and getting time back. This is where they stop doing everything themselves. If gaps exist, they are probably exhausted and wondering why it is not getting easier.
  * Level 3 (Organised): Talk about the shift from doing to building. Systems, planning, structure. This is where the business starts to feel like a real operation, not just them running fast.
  * Level 4 (Overseer): Talk about leadership and letting go. Working on the business, not just in it. This is where most founders get stuck because they are good at doing but not at managing.
  * Level 5 (Owner): Talk about the long game. Freedom, value, a business that runs without them. If this is mostly red, that is completely fine because it is the destination, not today's work.
- If lower levels have gaps: mention it once, briefly, as a helpful redirect. Not as a lecture. "The quickest win here would actually be going back to Level 1 and locking in your Focus and Cash Flow playbooks. That will make this level feel much more achievable."
- Never use the same redirect phrasing for multiple levels.

Level default overview (2-3 sentences, when no level is selected):
- Describe the pattern. Are they strong at the bottom and tapering up (normal)? Strong in the middle with gaps below (unusual, worth noting)?
- Name the growth edge: which level is their current frontier?
- Make it feel like a coach sizing up their game, not a report.

Pillar insights (2-4 sentences each, when a pillar row is tapped):
- Do NOT start with the score.
- Do NOT list which areas are strongest/weakest as the opening line.
- Each pillar has a completely different personality:
  * Foundation (Owner Performance): This is personal and warm. Talk about THEM, not the business. Energy, habits, mindset, leadership. "If you burn out, none of the rest matters." This pillar only has one area, so do NOT compare areas. Talk about the 5 playbooks within it and what they say about the owner's personal development arc.
  * Clarify Vision: Talk about clarity and direction. Is the path clear enough that their team could follow it without them explaining it every day? Or is the strategy still mostly in their head?
  * Control Velocity: This is the money engine. Be energetic. Talk about revenue, customers, cash, delivery. This is where profit comes from. If it is low, they are probably working harder than they need to for the money coming in.
  * Create Value: Long-term thinking. Systems, numbers, people. This naturally develops last, so low scores here are normal. Do not make them feel bad. Talk about what it means to build something that has value beyond their daily involvement.
- Name 1-2 specific playbooks and explain what fixing them would actually change in their business.

Pillar default overview (2-3 sentences, when no pillar is selected):
- Compare the four pillars and name where the biggest gap is
- Frame it as "this is where your time will have the most impact"
- Different angle from the Overall Short

Area insights (2-4 sentences each, when an area row is tapped):
- Do NOT start with the score.
- Each area has 5 playbooks (one per level). Talk about what the pattern says: have they nailed the basics but not the advanced stuff (normal)? Have they skipped ahead (worth noting)?
- Name 1-2 specific playbooks by name and tell them what fixing those will do for their business in practical terms.
- Each area insight must feel distinct. Revenue & Marketing should sound completely different from Infrastructure & Systems.
- Examples of good area coaching:
  * Revenue & Marketing: "You know who your ideal customer is, but you do not have a reliable way to get them through the door yet. That is the gap. One consistent lead generation channel will change everything about how new business feels."
  * Infrastructure & Systems: "Right now the business runs on effort and memory. That works until it does not. Getting even one core process documented means someone else can do it, and you get your evenings back."
  * Owner Performance: "Your Focus and Time & Energy playbooks are solid, which means you have the capacity to grow. The gap is in Mindset & Habits and Leadership. As the business scales, your personal operating system becomes the ceiling."

Area default overview (2-3 sentences, when no area is selected):
- Name the strongest and weakest areas, but frame it as where they have built well and where the biggest opportunity sits
- Different angle from the Overall Short

OUTPUT FORMAT
Return valid JSON only. No markdown, no backticks, no preamble. Just the JSON object.

{
  "overallShort": { "title": "...", "body": "..." },
  "overallLong": { "title": "...", "body": "..." },
  "levelsDefault": { "title": "...", "body": "..." },
  "pillarsDefault": { "title": "...", "body": "..." },
  "areasDefault": { "title": "...", "body": "..." },
  "levels": {
    "0": { "title": "...", "body": "..." },
    "1": { "title": "...", "body": "..." },
    "2": { "title": "...", "body": "..." },
    "3": { "title": "...", "body": "..." },
    "4": { "title": "...", "body": "..." }
  },
  "pillars": {
    "foundation": { "title": "...", "body": "..." },
    "vision": { "title": "...", "body": "..." },
    "velocity": { "title": "...", "body": "..." },
    "value": { "title": "...", "body": "..." }
  },
  "areas": {
    "0": { "title": "...", "body": "..." },
    "1": { "title": "...", "body": "..." },
    "2": { "title": "...", "body": "..." },
    "3": { "title": "...", "body": "..." },
    "4": { "title": "...", "body": "..." },
    "5": { "title": "...", "body": "..." },
    "6": { "title": "...", "body": "..." },
    "7": { "title": "...", "body": "..." },
    "8": { "title": "...", "body": "..." },
    "9": { "title": "...", "body": "..." }
  }
}`;

const LEVEL_NAMES = ["Overwhelm", "Overworked", "Organised", "Overseer", "Owner"];

export function buildScorePayload(answers: AnswersMap): string {
  const overallScore = getTotalScore(answers);
  const breakdown = computeScoreBreakdown(answers);
  const levelScores = computeLevelScores(answers);
  const pillarScores = computePillarScoresWithFoundation(answers);
  const focusItems = computeFocusAreas(answers);

  let grid = "PLAYBOOK SCORES (0=red, 1=amber, 2=green). Ref format is level.area (e.g. 1.0 = Level 1, Area 0).\n\n";

  for (let areaIdx = 0; areaIdx < 10; areaIdx++) {
    grid += `${AREAS[areaIdx].name}:\n`;
    for (let level = 1; level <= 5; level++) {
      const ref = `${level}.${areaIdx}`;
      const p = PLAYBOOKS.find((x) => x.ref === ref);
      const score = answers[ref];
      const status =
        score === 0 ? "RED" : score === 1 ? "AMBER" : score === 2 ? "GREEN" : "UNSCORED";
      grid += `  Level ${level} (${LEVEL_NAMES[level - 1]}): ${p?.name ?? ref} = ${status}\n`;
    }
    grid += "\n";
  }

  grid += `OVERALL SCORE: ${overallScore}/100\n`;
  grid += `COLOUR BREAKDOWN: ${breakdown.green} green, ${breakdown.amber} amber, ${breakdown.red} red\n`;

  grid += "\nLEVEL SCORES:\n";
  levelScores.forEach((ls, i) => {
    grid += `  Level ${ls.level} (${LEVEL_NAMES[i]}): ${ls.percent}% (${ls.sum}/20)\n`;
  });

  grid += "\nPILLAR SCORES:\n";
  grid += `  Foundation (Owner Performance): ${Math.round((pillarScores.foundation / 10) * 100)}% (${pillarScores.foundation}/10)\n`;
  grid += `  Clarify Vision: ${Math.round((pillarScores.vision / 30) * 100)}% (${pillarScores.vision}/30)\n`;
  grid += `  Control Velocity: ${Math.round((pillarScores.velocity / 30) * 100)}% (${pillarScores.velocity}/30)\n`;
  grid += `  Create Value: ${Math.round((pillarScores.value / 30) * 100)}% (${pillarScores.value}/30)\n`;

  grid += "\nAREA SCORES:\n";
  for (let areaIdx = 0; areaIdx < 10; areaIdx++) {
    let sum = 0;
    for (const p of PLAYBOOKS) {
      if (p.area !== areaIdx) continue;
      const v = answers[p.ref];
      if (v === 0 || v === 1 || v === 2) sum += v;
    }
    grid += `  ${AREAS[areaIdx].name}: ${Math.round((sum / 10) * 100)}% (${sum}/10)\n`;
  }

  grid += "\nPRIORITY PLAYBOOKS (from weighted scoring, most important first):\n";
  focusItems.slice(0, 15).forEach((item, i) => {
    const status = item.status === 0 ? "red" : "amber";
    grid += `  ${i + 1}. ${item.name} (Level ${item.level}, ${item.ref}) ${status}\n`;
  });

  grid += "\nGenerate all 23 insights based on this data. Return valid JSON only.";
  return grid;
}

export type StoredInsights = {
  overallShort: { title: string; body: string };
  overallLong: { title: string; body: string };
  levelsDefault: { title: string; body: string };
  pillarsDefault: { title: string; body: string };
  areasDefault: { title: string; body: string };
  levels: Record<string, { title: string; body: string }>;
  pillars: Record<string, { title: string; body: string }>;
  areas: Record<string, { title: string; body: string }>;
};

function fallbackInsights(): StoredInsights {
  const fallback = { title: "Your overview", body: "Insights will appear here once generated." };
  const levelFallback = (i: number) => ({ title: `Level ${i + 1}`, body: "Tap to see guidance for this level." });
  const pillarKeys = ["foundation", "vision", "velocity", "value"];
  return {
    overallShort: { title: "Your score", body: "Your insights are being generated. Check back in a moment." },
    overallLong: { title: "Full overview", body: "Expand this section after insights have been generated." },
    levelsDefault: fallback,
    pillarsDefault: fallback,
    areasDefault: fallback,
    levels: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [String(i), levelFallback(i)])),
    pillars: Object.fromEntries(pillarKeys.map((k) => [k, fallback])),
    areas: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [String(i), { title: AREAS[i].name, body: "Guidance for this area will appear here." }])
    ),
  };
}

function parseInsightsJson(raw: string): StoredInsights | null {
  const trimmed = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    if (
      !p.overallShort ||
      !p.overallLong ||
      !p.levelsDefault ||
      !p.pillarsDefault ||
      !p.areasDefault ||
      !p.levels ||
      !p.pillars ||
      !p.areas
    )
      return null;
    return parsed as StoredInsights;
  } catch {
    return null;
  }
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

export async function generateInsights(answers: AnswersMap): Promise<StoredInsights> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    console.warn("InsightGenerator: ANTHROPIC_API_KEY not set, returning fallback.");
    return fallbackInsights();
  }

  const userMessage = buildScorePayload(answers);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: INSIGHT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("InsightGenerator: API error", response.status, errText);
      return fallbackInsights();
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text;
    if (!text) {
      console.error("InsightGenerator: No text in response");
      return fallbackInsights();
    }

    const insights = parseInsightsJson(text);
    if (!insights) {
      console.error("InsightGenerator: Failed to parse JSON", text.slice(0, 200));
      return fallbackInsights();
    }
    return insights;
  } catch (err) {
    console.error("InsightGenerator: Request failed", err);
    return fallbackInsights();
  }
}
