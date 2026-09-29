import * as fs from "node:fs";
import * as path from "node:path";

import { blocksToMarkdown, BLOCKS_SCHEMA_PROMPT } from "./blocks";
import { sectionByKey } from "./blueprint";
import { summarizeKnowledgeForPrompt } from "./prompts";
import type { InterviewTurn, PracticeKnowledgeRow } from "./types";

/**
 * The AI skills that write each "We build" section of the Practice Blueprint.
 * Method lives in content/practice-skills/*.md (editable). This file says
 * which method each section uses and exactly what to produce.
 */

export type SectionSkill = {
  /** Method file in content/practice-skills. */
  file: string;
  /** What to write for this coach, and how to lay it out in blocks. */
  task: string;
  maxTokens?: number;
};

export const SECTION_SKILLS: Record<string, SectionSkill> = {
  "story:bio": {
    file: "story.md",
    task: `Write the coach's proof summary and short bio.
Blocks, in this order:
1. lede: one or two sentences that say who they are and the most impressive thing they have done.
2. stats: two to four real numbers from their record (years in business, a result, team size). Only real numbers. Skip the block if there are fewer than two.
3. heading "Proof inventory", then a table with columns Result, Where, Timeframe, How, Status. Status is "Ready" when the result has a from, a to and a timeframe, otherwise "Needs a number".
4. heading "Short bio", then a paragraph: first person, 60 to 90 words.
5. heading "One-line introduction", then a paragraph with one sentence.
6. heading "For partners and events", then a paragraph: the same bio in the third person.
7. If a result needs a number, a callout (tone "note") saying exactly what to add.`,
  },
  "story:onepager": {
    file: "story.md",
    task: `Write the coach's one-page profile: the page they can hand to a partner, recruiter, accountant or bank.
Blocks, in this order:
1. lede: who they are and who they help, two sentences, third person.
2. stats: their three strongest proof points as numbers (only real ones).
3. heading "Who I help", then a paragraph naming the core client and the avatar in plain words.
4. heading "The problems I fix", then bullets (four, in the owner's words).
5. heading "How I work", then steps (three steps from first conversation to results).
6. heading "Results", then bullets (two or three, specific).
7. heading "Working together", then a paragraph for referral partners: who to introduce, and why it helps their clients.
8. pairs with contact details you know (LinkedIn, website, location). Leave out anything missing.`,
  },
  "voice:sound": {
    file: "voice.md",
    task: `Write the coach's voice guide from how they talk in the conversation transcript and their LinkedIn text.
Blocks, in this order:
1. lede: two sentences describing how they come across.
2. pairs: Tone (three to five words), Pace, Formality, Humour, Regional flavour.
3. heading "Sounds like", then bullets: three short lines written in their voice.
4. heading "Does not sound like", then bullets: three lines to avoid.
5. heading "Words and phrases to use", then bullets.
6. heading "Words to avoid", then bullets.
7. heading "A message in your voice", then a message block (label "Example") of 60 to 90 words to an owner in their market.`,
  },
  "market:options": {
    file: "core-client.md",
    task: `Give two or three core client options for this coach, scored and recommended.
Blocks, in this order:
1. lede: the recommendation in one sentence.
2. table with columns Option, Value, Pain, Growing, Easy to find, Purchasing power, Total. Scores 1 to 5, total out of 25.
3. For each option: heading with the option name, then a paragraph on why it fits their proof and what the owner's pain is.
4. heading "Recommended core client", then a quote with the full core client sentence ("My core client is ... with 10 to 50 employees doing £1M to £20M revenue.").
5. callout (tone "tip") on how to decide on the Decision Call if two options are close.`,
  },
  "market:avatar": {
    file: "avatar.md",
    maxTokens: 6000,
    task: `Write the avatar for the recommended core client. Use the market options section above for the market.
Blocks, in this order:
1. lede: the persona headline, for example "Site-Bound Steve: MD of a 30-person scaffolding firm in Yorkshire".
2. pairs: Name, Age, Location, Business, Revenue, Team, Role, Time in the business.
3. heading "A day in the life", then a paragraph: present tense, a specific time of day, ends on a realisation.
4. heading "In his words" (or her or their, from the persona), then a quote: the internal monologue, first person, ends confused.
5. heading "What they want", then bullets (three to five dreams).
6. heading "What they fear", then bullets.
7. heading "What they have tried", then bullets (past failures).
8. heading "What they suspect", then bullets (about coaches, consultants, systems).
9. heading "What finally makes them act", then bullets (triggering events).
10. heading "How they talk", then a table with columns Thing, What they call it (customers, staff, jobs, money, and two or three extra trade terms).
11. heading "Ready to act", then a quote: their outward-facing line, first person.`,
  },
  "market:pains": {
    file: "pain-points.md",
    maxTokens: 6000,
    task: `Write the pain points for the avatar above.
Blocks, in this order:
1. lede: the one pain that sits under all the others, in the owner's words.
2. table with columns Pain, What they say out loud, What it costs, What they want instead, Lever. Five to seven rows, most common first.
3. heading "At 3am", then a quote: three short first-person lines.
4. heading "Main desire hooks", then bullets: three phrases that finish "Are you looking to ...?"
5. heading "Buying triggers", then bullets.
6. heading "Objections and honest answers", then a table with columns Objection, Answer.`,
  },
  "market:criteria": {
    file: "prospect-criteria.md",
    task: `Write the prospect criteria for the avatar above, ready for the team to build in Sales Navigator.
Blocks, in this order:
1. lede: who is on the list, in one sentence.
2. table with columns Filter, Include, Exclude (connections, location, headcount, job titles, industry, keywords, company exclusions).
3. heading "Keyword strings to try", then bullets.
4. heading "Leave out", then bullets (from who they will not take, plus coaches, consultants and recruiters).
5. stats: target list size, expected acceptance rate, expected reply rate.
6. callout (tone "tip"): the KPI to watch in the first two weeks.`,
  },
  "linkedin:rewrite": {
    file: "linkedin-profile.md",
    maxTokens: 6000,
    task: `Rewrite the coach's LinkedIn profile. Respect whether they are public or discreet about coaching. If unknown, write the public version and add a callout (tone "note") saying a discreet version is available on request.
Blocks, in this order:
1. lede: what the rewrite changes, in one sentence.
2. heading "Headline", then a message block (label "Headline") under 220 characters.
3. heading "About", then a message block (label "About section") with the full About text in their voice, line breaks included.
4. heading "Core skills", then a table with columns Skill, What it means for the owner (four rows).
5. heading "Key milestones", then bullets (three or four, only from their record).
6. heading "Banner", then a message block (label "Banner line").
7. heading "Featured", then bullets (three items to pin).
8. heading "Checklist", then steps (headshot, URL, company page, contact info, job titles).`,
  },
  "campaigns:messaging": {
    file: "campaigns.md",
    maxTokens: 7000,
    task: `Write the outreach campaigns for this coach and avatar, using their best real proof.
Blocks, in this order:
1. lede: the angle of the campaign in one sentence.
2. pairs: Core client, Main desire, Proof used, Proof type (client or career).
3. heading "Campaign A: Connector", then message blocks for Connection request (under 275 characters, note the character count), Message 1 (30 minutes), Message 2 (1 day), Message 3 (2 days), Message 4 (4 days), Message 5 (2 weeks). Put the timing in each note.
4. heading "Open InMail", then one message block.
5. heading "Campaign B: Conversation into the BOSS Scorecard", then four message blocks (after connecting, insight, scorecard offer, leave the link).
6. heading "Check before launch", then a table with columns Check, Pass (the ten connection message checks, each Yes or Fix with a reason).
If the proof has no number yet, keep the placeholder in square brackets and add a callout (tone "warning") saying the campaign cannot launch until it has one.`,
  },
  "conversations:followup": {
    file: "replies-nurture.md",
    maxTokens: 6000,
    task: `Write the replies and nurture for this coach's campaigns.
Blocks, in this order:
1. lede: how to handle replies in one sentence.
2. heading "When they reply", then for each common reply a message block whose label is the prospect's reply (for example "They say: How much is it?") and whose body is what to send back. Cover: yes interested, what is it exactly, how much is it, not right now, we are doing fine, who are you, a neutral one-liner, send me some info.
3. heading "Avoid", then bullets (the reply mistakes, short).
4. heading "VIP nurture: top 100", then a callout (tone "tip") on who goes on the top 100 list and the rhythm (every two weeks), then three message blocks, each giving away one BCA tool that fits the avatar's pains (for example "Profit Maximiser", "Cashflow Forecaster", "Time Value Tracker"), personalised first line as a {personalisation} placeholder, three emoji-numbered benefits, and a [link] placeholder.
5. heading "Nurture rhythm", then a timeline for people who said not now (for example Week 2, Week 5, Week 8, Day 90).`,
  },
  "offer:direction": {
    file: "offer.md",
    maxTokens: 5000,
    task: `Write the coach's offer and positioning.
Blocks, in this order:
1. lede: the positioning line ("I help ... without ... using ...").
2. heading "The gap", then a table with columns Today, What they want (four rows, business and personal).
3. heading "Why they will buy", then bullets (know-how, speed, ease, tied to this avatar).
4. heading "Key messages", then numbered (three to five, all about the buyer's problems).
5. heading "The offer", then pairs: Name, Promise, Who it is for, What is included, Format, Proof.
6. heading "Why you", then bullets (proof stack from their record only).`,
  },
  "offer:payment": {
    file: "offer.md",
    task: `Write the proposal and payment options for this coach.
Blocks, in this order:
1. lede: how the price is framed in one sentence.
2. table with columns Option, Investment, Best for. Include monthly and six months upfront (with a split payment). Respect their minimum fee: never price below it.
3. heading "If they ask the price early", then a message block with the anchor script, in their voice.
4. heading "At the end of the call", then a message block with the either-or close.
5. heading "Proposal outline", then steps (the sections of a one-page proposal).
6. heading "Raising your price", then a paragraph on when and by how much.`,
  },
  "sales:value": {
    file: "sales.md",
    maxTokens: 8000,
    task: `Design this coach's value session and its launch kit: the free, pitch-free session built around their superpower and the avatar's main pain.
Blocks, in this order:
1. lede: the name of the session and what the owner walks away with.
2. pairs: Name, Length, Who it is for, What they get, The promise.
3. heading "The questions", then a table with columns Area, Question, Red looks like, Green looks like (eight to ten rows, built on the coach's superpower and the avatar's pains).
4. heading "Your opening questions", then numbered: the four questions (challenge, 12 months from now, why it matters personally, what they have tried) reworded for this avatar.
5. heading "The magic question", then a message block with the magic question and the bridge into the offer (three things tied to pain, goal and personal driver).
6. heading "The launch kit", then message blocks: "Launch email" (subject line on the first line), "Nudge email", "LinkedIn DM invite", "LinkedIn DM nudge", "LinkedIn Featured description", "Calendar page description".
7. heading "If they say not now", then a paragraph.`,
  },
  "sales:script": {
    file: "sales.md",
    maxTokens: 7000,
    task: `Write the coach's call script, tailored to the avatar and the offer.
Blocks, in this order:
1. lede: what this call does, one sentence.
2. heading "Opening", then a message block.
3. heading "Questions that find the gap", then numbered (eight to ten questions in the owner's language).
4. heading "Transition", then a message block.
5. heading "The game plan", then steps: three steps, each with what the coach says, tied to the avatar's pains. Add a check-in question after each.
6. heading "Results and proof", then a paragraph with the coach's real proof.
7. heading "Price and close", then a message block.
8. heading "Objections", then a table with columns They say, You say (money, time to think, partner, timing, fear).`,
  },
  "content:posts": {
    file: "content.md",
    maxTokens: 6000,
    task: `Write this coach's content starter kit.
Blocks, in this order:
1. lede: the content angle in one sentence.
2. heading "Content pillars", then a table with columns Pillar, What it covers, Example hook (three or four pillars).
3. heading "Twelve post ideas", then numbered (each one line: the hook).
4. heading "Ready to post", then two message blocks (label "Proof story" and label "The 3am thought"), each a full LinkedIn post of 120 to 220 words in the coach's voice with a soft call to action.
5. callout (tone "tip") on posting rhythm.`,
  },
  "content:newsletter": {
    file: "content.md",
    maxTokens: 6000,
    task: `Design this coach's newsletter and write the first issue.
Blocks, in this order:
1. lede: the newsletter's promise to the reader.
2. pairs: Name, Who it is for, How often, Format, Call to action.
3. heading "The first issue", then a message block (label "Issue 1") with a subject line on the first line, then the full issue under 500 words, ending with the value session offer.
4. heading "The next six issues", then a table with columns Issue, Subject line, The one idea.`,
  },
  "ninety:quarter": {
    file: "ninety-days.md",
    task: `Write the coach's 90-day launch plan.
Blocks, in this order:
1. lede: the one objective for the quarter.
2. stats: the income goal, clients needed, calls needed, and conversations needed (derive from their fee and capacity; if unknown use £10k a month and six clients and say so in a callout).
3. heading "Week by week", then a timeline (Weeks 1 to 2, Weeks 2 to 4, Weeks 4 to 8, Weeks 8 to 12, each with a title and detail).
4. heading "Weekly numbers", then a table with columns Activity, Per week.
5. heading "This week", then steps (three things).
6. callout (tone "warning") with the most likely constraint for this coach and how to spot it.`,
  },
};

const SKILL_DIR = path.join(process.cwd(), "content", "practice-skills");
const WRITING_RULES = path.join(process.cwd(), "content", "ai-knowledge", "writing-rules.md");

function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

export function skillSystemPrompt(key: string): string | null {
  const skill = SECTION_SKILLS[key];
  if (!skill) return null;
  return [
    readText(path.join(SKILL_DIR, "_shared.md")),
    readText(WRITING_RULES),
    `# Method for this section\n\n${readText(path.join(SKILL_DIR, skill.file))}`,
    `# Output format\n\nYou are writing one section of a premium, printed-quality document called the Practice Blueprint. It should read like strategy work a coach would pay £50,000 for: specific, confident, grounded in their facts, and easy to act on. Open every section with a lede. Prefer tables, steps and message blocks over long prose.\n\n${BLOCKS_SCHEMA_PROMPT}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function transcriptText(turns: InterviewTurn[]): string {
  return turns
    .slice(-40)
    .map((t) => `${t.role === "user" ? "Coach" : "Interviewer"}: ${t.content}`)
    .join("\n")
    .slice(0, 12000);
}

/** Other written sections this one should build on, as Markdown. */
function upstreamText(key: string, row: PracticeKnowledgeRow): string {
  const ref = sectionByKey(key);
  const wanted = new Set<string>(ref?.section.needs ?? []);
  // Direct needs, plus the sections those need, so the avatar reaches the campaigns.
  for (const need of [...wanted]) {
    for (const deeper of sectionByKey(need)?.section.needs ?? []) wanted.add(deeper);
  }
  // Always useful when present.
  for (const extra of ["story:bio", "voice:sound", "market:avatar", "market:pains", "offer:direction"]) {
    if (extra !== key && row.built_sections[extra]) wanted.add(extra);
  }
  const parts: string[] = [];
  for (const need of wanted) {
    const built = row.built_sections[need];
    const title = sectionByKey(need)?.section.title ?? need;
    if (built) parts.push(`## ${title}\n\n${blocksToMarkdown(built.blocks, 3)}`);
  }
  return parts.join("\n\n").slice(0, 30000);
}

export function skillUserPrompt(opts: {
  key: string;
  row: PracticeKnowledgeRow;
  coachName: string;
  linkedinSummary: string;
  turns: InterviewTurn[];
  decision: string;
  library: string;
}): string {
  const skill = SECTION_SKILLS[opts.key];
  const ref = sectionByKey(opts.key);
  const report = opts.row.report_payload;
  const visibility = opts.row.payload.identity.linkedin_visibility?.value ?? "unknown";
  return [
    `# Task: ${ref?.section.title ?? opts.key}`,
    skill?.task ?? "",
    `# Coach\n\nName: ${opts.coachName}\nLinkedIn visibility: ${visibility}`,
    `## What they told us and what we imported\n\n${summarizeKnowledgeForPrompt(opts.row.payload)}`,
    `## LinkedIn\n\n${opts.linkedinSummary.slice(0, 6000) || "(not imported)"}`,
    report
      ? `## Decision Call pre-read\n\n${JSON.stringify(
          {
            experience_summary: report.experience_summary,
            market_hypotheses: report.market_hypotheses,
            offer_direction: report.offer_direction,
            positioning: report.positioning,
            campaign_angle: report.campaign_angle,
          },
          null,
          1
        ).slice(0, 6000)}`
      : "",
    opts.decision ? `## Decision Record (locked choices win over everything else)\n\n${opts.decision}` : "",
    opts.library ? `## Industry library notes\n\n${opts.library.slice(0, 5000)}` : "",
    `## Sections already written\n\n${upstreamText(opts.key, opts.row) || "(none yet)"}`,
    opts.turns.length ? `## Conversation transcript\n\n${transcriptText(opts.turns)}` : "",
    "Write the section now. Return only the JSON object.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
