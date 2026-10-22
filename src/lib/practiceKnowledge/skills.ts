import * as fs from "node:fs";
import * as path from "node:path";

import { peekAgentOverride } from "@/lib/agent/agentOverrides";
import { blocksToMarkdown, BLOCKS_SCHEMA_PROMPT } from "./blocks";
import { ALWAYS_READS, buildOrder, sectionByKey, type WriterSource } from "./blueprint";
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
    task: `Write the coach's short bio, in three versions. How they want to be known and the kind of coach they are (boot camp, hugs, a mix) should be readable in the bio, without naming those labels unless they would. Their results are already on the page above as their own cards, so do not list them again.
Blocks, in this order:
1. lede: one or two sentences that say who they are, the kind of coach they are, and the most impressive thing they have done.
2. stats: two to four real numbers from their record (years in business, a result, team size). Only real numbers. Skip the block if there are fewer than two.
3. heading "Short bio", then a paragraph: first person, 60 to 90 words.
4. heading "One-line introduction", then a paragraph with one sentence.
5. heading "For partners and events", then a paragraph: the same bio in the third person.`,
  },
  "voice:sound": {
    file: "voice.md",
    task: `Write the coach's voice guide. The coach's own tone sliders, their "Sounds like" example, their "Never sounds like" notes, how they want to be known and the kind of coach they are, are the source of truth: follow them over anything you infer. Use the conversation transcript and their LinkedIn text for words and rhythm. Use their values, likes, dislikes, pet peeves, book, film, hobbies and stories only as they gave them. Never invent a hobby, a book, a film or a scene from their life.
Blocks, in this order:
1. lede: two sentences describing how they come across, matching the tone sliders and the kind of coach they are.
2. heading "Sounds like", then bullets: three short lines written in their voice, in the rhythm of their own example.
3. heading "Does not sound like", then bullets: three lines to avoid, including anything from their "Never sounds like" notes.
4. heading "The kind of coach you are", then a paragraph: how they want to be known, and where they sit on mentor to coach, growth to lifestyle, and tough love to nurturing.
5. heading "What you stand for", then bullets from their values, qualities, likes, dislikes and pet peeves. Skip this heading if they gave none.
6. heading "What to draw on", then bullets of analogies from their favourite book, film, hobbies, sports and any story they offered. Skip this heading if they named none.`,
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
    task: `Write the avatar walkthrough for the recommended core client. When the coach has filled the ideal client sections (who they are, what they are going through, in their words, what makes them act, and why you), those lines are the source of truth. Use them in the order the coach put them, and do not swap in a different person. Use the market options section for the market when those sections are still thin.
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
    task: `Write the pain points for the avatar above. When the coach has filled what they are going through and what makes them act, use those lines in the coach's order. Do not invent a different problem.
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
  "campaigns:messaging": {
    file: "campaigns.md",
    maxTokens: 6000,
    task: `Write the connection campaign for this coach and avatar, using their best real proof. It goes to new owners from a list, 2nd and 3rd degree. Keep the sequence short and proof-led. Match the kind of coach they are in the word choice only (a boot camp coach is more direct than hugs). Do not add hobbies, books or stories here. There is not room.
Blocks, in this order:
1. lede: the angle of the campaign in one sentence.
2. pairs: Core client, Main desire, Proof used, Proof type (client or career).
3. heading "The sequence", then message blocks for Connection request (under 275 characters, note the character count), Message 1 (30 minutes), Message 2 (1 day), Message 3 (2 days), Message 4 (4 days), Message 5 (2 weeks). Put the timing in each note.
4. heading "Check before launch", then a table with columns Check, Pass (the ten connection message checks, each Yes or Fix with a reason).
If the proof has no number yet, keep the placeholder in square brackets and add a callout (tone "warning") saying the campaign cannot launch until it has one.
Every story, anecdote, number and result about the coach must come from their record. If a message needs one the record does not have, write a [square-bracket prompt] for the coach to fill instead. Never make one up.
Use only these tokens in curly brackets: {first_name}, {company}, {assessment_url}. Anything the coach fills in by hand goes in square brackets.`,
  },
  "campaigns:conversation": {
    file: "campaigns.md",
    maxTokens: 5000,
    task: `Write the messaging campaign: for owners this coach can message without a connection request, meaning connections who fit the avatar but they have never spoken to, and open InMail. A short conversation that leads to the BOSS Scorecard. Match the kind of coach they are in the word choice. Do not add hobbies, books or stories here.
Blocks, in this order:
1. lede: the angle in one sentence.
2. heading "Who gets it", then bullets: which existing connections to pick, and when to use InMail instead.
3. heading "The sequence", then four message blocks: "First message" (a question about their focus, no pitch), "Insight" (3 days), "Scorecard offer" (4 days), "Leave the link" (5 days). Put the timing in each note.
4. heading "Open InMail", then one message block (label "InMail") with the subject line on the first line.
Use only these tokens in curly brackets: {first_name}, {company}, {assessment_url}. Anything the coach fills in by hand goes in square brackets.`,
  },
  "campaigns:reactivation": {
    file: "campaigns.md",
    maxTokens: 5000,
    task: `Write the reactivation campaign: for people the coach already knows, meaning past colleagues, old contacts, and connections who replied before and went quiet. It restarts the relationship. It does not pitch. There is more room than a connection note: "What I do now" should sound like the kind of coach they are, and may use one hobby or story they named if it fits naturally. Never invent one.
Blocks, in this order:
1. lede: why their existing network is worth restarting, in one sentence, tied to their career.
2. heading "Who gets it", then bullets: the groups to pick from their connections, named from their roles and industries (former colleagues at a named company, suppliers, clients from past roles), then who to leave out.
3. heading "The sequence", then three message blocks: "Reconnect" (personal, one line about shared history in square brackets for the coach to fill, no pitch, ends with a question about them), "What I do now" (5 days: who they help now, the kind of coach they are in plain words, and one real proof point), "Soft ask" (2 weeks: do they know an owner who would want this, or would they like the BOSS Scorecard). Put the timing in each note. Keep each under 500 characters.
4. callout (tone "tip"): personalise the first line for every person, and start with the warmest 50.
Use only these tokens in curly brackets: {first_name}, {company}, {assessment_url}. Anything the coach fills in by hand goes in square brackets.`,
  },
  "offer:direction": {
    file: "offer.md",
    maxTokens: 5000,
    task: `Write the coach's one-page offer in the finalised-offer shape. Do not include the price.
Blocks, in this order:
1. lede: the positioning line ("I help ... without ... using ..."), in their words.
2. heading "Who we help", then a paragraph (who they are) and bullets (five lines of what they typically live with). Pull who from the avatar. Do not invent a new market.
3. heading "Our promise", then a paragraph: the destination they named (money, time or team), the more-of and less-of lines, and the first result they can point to if they named a clock. Taki's filters: specific, can they point to it, do they want it, do they get it. Never promise income you cannot control.
4. heading "Our strategy", then numbered: three to six lines of what they actually help with, each with why it works (the factor of value). Their language, not Profit System area names unless they used those words.
5. heading "Our guarantee", then a paragraph from their terms. If they have none, say so in one line and stop.
6. heading "If you work with us", then a paragraph (best case: they get the more-of). Then heading "Or you can", then a paragraph (worst case: they can leave under the guarantee, or they still have the plan). No invented cash-back.
7. heading "Think of this as", then a paragraph: the packaging. What it is, and what it is not.
8. heading "Why you", then bullets (proof stack from their record only).`,
  },
  "offer:lines": {
    file: "offer.md",
    task: `Write the coach's offer in three lengths, each marked with where to use it, using "Your offer in three lengths" in the method.
Blocks, in this order:
1. heading "Short", then a message block (label "Short line") of 6 to 12 words, with a note "Use in: LinkedIn headline, introductions, email signature".
2. heading "Medium", then a message block (label "Medium") of one or two sentences, with a note "Use in: when someone asks what you do, the first line of a message, the top of your About section".
3. heading "Long", then a message block (label "Paragraph") of 60 to 100 words: who it is for, the gap you close, how, and the best proof, with a note "Use in: LinkedIn About, the 90-day brochure, the opening of a proposal".
4. If the coach has a guarantee (not "none"), heading "Your guarantee", then two message blocks (labels "Guarantee, short" and "Guarantee, medium") written from their terms. If they have none, skip this.`,
  },
  "sales:script": {
    file: "sales.md",
    maxTokens: 7000,
    task: `Write the coach's learnable call script: the Profit System pitch they practise, already flavoured for their avatar, plus the lines they swap on the call.
Blocks, in this order:
1. lede: what this call does, one sentence.
2. heading "Opening", then a message block: reflect outcome, problem, impact, desired future and personal why, then "Have I understood that correctly?"
3. heading "The system you walk them through", then a paragraph naming Vision, Velocity, Value and the nine steps in order. This never changes.
4. heading "The game plan", then steps: the nine Profit System steps (Aligned Vision, Defined Strategy, Disciplined Planning, Profit & Cash Flow, Revenue & Marketing, Operations & Delivery, Financials & Metrics, Infrastructure & Systems, Team & Leadership). Each step is three short spoken lines following the logic because you told me / what we will do / which means, worded differently on each step (never open every step with "because you told me"), written for this avatar's main pain, with a [bracket] for the line they swap for this owner. A check-in they can skip after each.
5. heading "Bringing it together", then a message block ending with "How do you feel about the structure and approach specifically?"
6. heading "What you adapt on the call", then bullets: the five facts (priority, pain, result, number, personal why), and that every "for you" line must use this owner's words.
7. heading "Results and proof", then a paragraph with the coach's real proof only.
8. heading "Price and close", then a message block.
9. heading "Objections", then a table with columns They say, You say (money, time to think, partner, timing, fear).`,
  },
  "content:checklist": {
    file: "linkedin-newsletter.md",
    task: `Write this coach's LinkedIn newsletter operating checklist, named for their market.
Blocks, in this order:
1. lede: what "running the newsletter" means for this coach, one sentence.
2. heading "The week you publish", then steps: publish the issue, send the VIP inbox note to the top 100 (first line personal), turn on the LinkedIn bell for that list, check notifications, and comment on VIP posts.
3. heading "Stretch the issue", then bullets: one article or post per strategy, a carousel from the five strategies or the seven-point checklist, invite readers to a workshop (never say webinar).
4. heading "VIP nurture", then a paragraph: personalise the first line from one of their posts, then use the template. Two to four times a month.
5. callout (tone "tip") on soft CTAs most weeks, and the Discovery call as the close of the issue.`,
  },
  "content:newsletter": {
    file: "linkedin-newsletter.md",
    maxTokens: 8000,
    task: `Write this coach's LinkedIn newsletter issue in the 5-3-7 shape, for their avatar, in their voice.
500 to 1500 words. Language a 12-year-old would understand. Headings an owner can skim. Intriguing, not hype. Write as the kind of coach they are (boot camp, hugs, a mix). Open with a real story they gave us, or an analogy from a book, film, hobby or sport they named on Your Voice. If none fits, leave a square-bracket prompt for them to add one. Never invent one. The close should sound like how they want to be known.
The newsletter name, who it is for, how often and the closing wording already live in Newsletter info. Use them. Do not repeat them, and do not describe the newsletter (no "short read", no "one idea per issue", no line about who it is for). Start with this week's topic.
Blocks, in this order:
1. heading with the topic, then two or three short paragraphs that open the problem in the owner's words.
2. heading "Five strategies you can do", then for each strategy a heading and a short paragraph (specific to this market).
3. heading "Three things to avoid", then for each a heading and a short paragraph (costly, common, specific).
4. heading "This week's checklist", then numbered (exactly seven, doable this week).
5. heading "If you want a hand", then a paragraph. If they wrote call-to-action wording, use that sentence. If they did not, book a Discovery call with the coach by name, as a Business Profit Coach, with [calendar link] and their mobile if we have it. Never invent a number or a URL.
Write this issue only. Do not plan later issues, and do not add a table of future topics.
Write the issue as headings, paragraphs, bullets and numbered lists. Do not put the whole issue in one message block.`,
  },
  "content:cover": {
    file: "linkedin-newsletter.md",
    task: `Write the cover for the newsletter issue already written. Do not write the newsletter again.
Blocks, in this order:
1. lede: what this cover is for, one sentence.
2. pairs: Headline (this week's topic, short enough for a banner), Tagline (one line under the headline), Picture (what the photo or graphic should show, one sentence).
3. callout (tone "tip"): duplicate the header template, swap the small image, and put this headline and tagline on it.`,
  },
  "content:inbox": {
    file: "linkedin-newsletter.md",
    task: `Write the VIP inbox note for the issue already written. One note only.
Blocks, in this order:
1. lede: who this goes to, one sentence (the top 100).
2. A message block (label "Inbox"). First line in square brackets for the coach to personalise from one of that person's posts. Then what the newsletter is, two strategies from this issue, why it helps, and [link to the issue].
Use only these tokens in curly brackets: {first_name}, {company}. Anything the coach fills in by hand goes in square brackets.`,
  },
  "content:post": {
    file: "linkedin-newsletter.md",
    task: `Write the feed post for the issue already written. One post only. It is about the three things to avoid in that issue, and it points people to the newsletter for the strategies and the checklist.
Blocks, in this order:
1. lede: what the post is doing, one sentence.
2. A message block (label "Post") of 120 to 220 words. End with a pointer to the newsletter.`,
  },
  "content:inmail": {
    file: "linkedin-newsletter.md",
    task: `Write the LinkedIn InMail for the issue already written. One InMail only.
Blocks, in this order:
1. lede: who this is for, one sentence.
2. A message block (label "InMail") with a subject line on the first line, the five strategies from the issue, why the rest is worth reading, [link to the issue], and [calendar link].
Use only these tokens in curly brackets: {first_name}, {company}. Anything the coach fills in by hand goes in square brackets.`,
  },
  "content:article": {
    file: "linkedin-newsletter.md",
    maxTokens: 7000,
    task: `Write a LinkedIn article on the same topic as the newsletter issue already written. Reference that issue. End with how to book a Discovery call with the coach by name, as a Business Profit Coach.
600 to 1200 words. Same voice, kind of coach, and reading age as the newsletter. Headings they can skim. Use a story or analogy they named if it still fits. Never invent one.
Blocks, in this order:
1. lede: the article's promise, two sentences.
2. The article as headings and short paragraphs, with one real proof point if we have one.
3. heading "The newsletter", then a paragraph pointing to the issue and what they will get there (the five strategies, the three to avoid, the checklist).
4. heading "Talk to me", then a paragraph with the coach's name, Business Profit Coach, [calendar link] and their mobile if we have it.
Do not put the article in one message block.`,
  },
  "content:posts": {
    file: "content.md",
    maxTokens: 6000,
    task: `Write this coach's content starter kit. Write as the kind of coach they are. If they named a book, film, hobby or story, one pillar or several of the twelve ideas should draw on it. Never invent one.
Blocks, in this order:
1. lede: the content angle in one sentence, including the kind of coach they are.
2. heading "Content pillars", then a table with columns Pillar, What it covers, Example hook (three or four pillars).
3. heading "Twelve post ideas", then numbered (each one line: the hook).
4. heading "Ready to post", then two message blocks (label "Proof story" and label "The 3am thought"), each a full LinkedIn post of 120 to 220 words in the coach's voice with a soft call to action. Analogies only from a book, film, hobby or story they named.
5. callout (tone "tip") on posting rhythm.`,
  },
  "content:analogy": {
    file: "linkedin-newsletter.md",
    maxTokens: 7000,
    task: `Write a LinkedIn newsletter that teaches through an analogy: this avatar's business paired with a sport, hobby, book or film the coach named on Your Voice. If they named none, do not pick one. Write the issue without a personal analogy and add a callout asking them to name a book, film or hobby.
Same 5-3-7 bones as the main issue. Specific strategies, not a cute metaphor that never lands.
Blocks, in this order:
1. lede: the pairing in one sentence.
2. pairs: Name, The analogy, Who it is for, Call to action.
3. Two short paragraphs that set the pairing.
4. heading "Five strategies you can do", then a heading and a short paragraph for each, each one tied to both sides of the pairing.
5. heading "Three things to avoid", then the same.
6. heading "This week's checklist", then numbered (exactly seven).
7. heading "If you want a hand", then the Discovery call close with the coach's name, Business Profit Coach, [calendar link] and mobile if we have it.`,
  },
  "content:kpis": {
    file: "linkedin-newsletter.md",
    maxTokens: 6000,
    task: `Write a LinkedIn article that pairs KPIs from a sport or hobby the coach knows with the numbers that run this avatar's business.
Blocks, in this order:
1. lede: the pairing in two sentences.
2. heading "What good looks like", then a table with columns In the hobby or sport, In the business (four to six rows).
3. The article as headings and short paragraphs: what to measure, what to ignore, one move this week.
4. heading "Talk to me", then the Discovery call close with the coach's name, Business Profit Coach, [calendar link] and mobile if we have it.
If they named no hobby or sport, do not pick one. Write without that pairing and add a callout asking them to name one.`,
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

function readSkillFile(name: string): string {
  return peekAgentOverride(`practice-skills/${name}`) ?? readText(path.join(SKILL_DIR, name));
}

function readWritingRules(): string {
  return peekAgentOverride("ai-knowledge/writing-rules.md") ?? readText(WRITING_RULES);
}

export function skillSystemPrompt(key: string): string | null {
  const skill = SECTION_SKILLS[key];
  if (!skill) return null;
  return [
    readSkillFile("_shared.md"),
    readWritingRules(),
    `# Method for this section\n\n${readSkillFile(skill.file)}`,
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

/**
 * The written sections a writer is given when they exist: what it needs, what
 * those need, and the core guides written earlier in the build order (never
 * later ones, so a full rewrite does not feed on stale sections).
 */
export function writerUpstream(key: string): string[] {
  const wanted = new Set<string>(sectionByKey(key)?.section.needs ?? []);
  // Direct needs, plus the sections those need, so the avatar reaches the campaigns.
  for (const need of [...wanted]) {
    for (const deeper of sectionByKey(need)?.section.needs ?? []) wanted.add(deeper);
  }
  const order = buildOrder();
  const position = order.indexOf(key);
  for (const extra of ["story:bio", "voice:sound", "market:avatar", "market:pains", "offer:direction"]) {
    if (extra !== key && order.indexOf(extra) < position) wanted.add(extra);
  }
  return [...wanted];
}

/** Other written sections this one should build on, as Markdown. */
function upstreamText(key: string, row: PracticeKnowledgeRow): string {
  const parts: string[] = [];
  for (const need of writerUpstream(key)) {
    const built = row.built_sections[need];
    const title = sectionByKey(need)?.section.title ?? need;
    if (built) parts.push(`## ${title}\n\n${blocksToMarkdown(built.blocks, 3)}`);
  }
  return parts.join("\n\n").slice(0, 30000);
}

/** What one writer reads, from its contract. Sections without a contract read everything. */
export function writerContract(key: string): { fields: Set<string> | null; sources: Set<WriterSource> } {
  const uses = sectionByKey(key)?.section.uses;
  if (!uses) return { fields: null, sources: new Set<WriterSource>(["linkedin", "transcript", "preread", "library"]) };
  return { fields: new Set<string>([...ALWAYS_READS, ...uses.fields]), sources: new Set(uses.sources ?? []) };
}

export function skillUserPrompt(opts: {
  key: string;
  row: PracticeKnowledgeRow;
  coachName: string;
  linkedinSummary: string;
  turns: InterviewTurn[];
  decision: string;
  library: string;
  onboardingTranscript?: string;
}): string {
  const skill = SECTION_SKILLS[opts.key];
  const ref = sectionByKey(opts.key);
  const contract = writerContract(opts.key);
  const reads = (source: WriterSource) => contract.sources.has(source);
  const report = opts.row.report_payload;
  // Not asked any more (19 Oct): blank means public.
  const visibility = opts.row.payload.identity.linkedin_visibility?.value ?? "public";
  // Tenure is the number models most like to invent. Only LinkedIn durations count.
  const tenureKnown = /\b\d+\s*(yrs?|years?)\b/i.test(opts.linkedinSummary);
  const tenureLine = !tenureKnown
    ? "Years of experience: NOT STATED. Do not give a number of years anywhere (not in stats, bios or messages). Hours a week are not years."
    : reads("linkedin")
      ? "Years of experience: use only the durations shown in the LinkedIn section."
      : "Years of experience: use only the years already stated in the sections written before this one.";
  return [
    `# Task: ${ref?.section.title ?? opts.key}`,
    skill?.task ?? "",
    `# Coach\n\nName: ${opts.coachName}\nLinkedIn visibility: ${visibility}\n${tenureLine}`,
    `## What they told us and what we imported\n\n${summarizeKnowledgeForPrompt(opts.row.payload, contract.fields ?? undefined)}`,
    reads("linkedin") ? `## LinkedIn\n\n${opts.linkedinSummary.slice(0, 6000) || "(not imported)"}` : "",
    report && reads("preread")
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
    opts.library && reads("library") ? `## Industry library notes\n\n${opts.library.slice(0, 5000)}` : "",
    `## Sections already written\n\n${upstreamText(opts.key, opts.row) || "(none yet)"}`,
    reads("transcript") && (opts.onboardingTranscript || opts.turns.length)
      ? `## Conversation transcript\n\n${[opts.onboardingTranscript, opts.turns.length ? transcriptText(opts.turns) : ""]
          .filter(Boolean)
          .join("\n\n")}`
      : "",
    "Write the section now. Return only the JSON object.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
