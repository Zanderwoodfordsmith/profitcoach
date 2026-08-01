/**
 * Add the "Handling The Fear Objection" lesson to the Client Closing section.
 *
 * Content is an original, condensed rewrite of the fear-objection flows mapped
 * in the ClickUp sales doc (Guarantee / Never Invested / Burned In The Past /
 * Toxic Ex / Fear of Spending / What Would You Do / Role Model / FOMO / Time
 * Until First Client). Source concepts are third-party sales training IP, so
 * nothing is copied verbatim. Each reframe renders as an expandable
 * `details.lesson-accordion` section inside the Guide tab.
 *
 * Inserts before "Universal Closes & Final Moves". Run:
 *   npx tsx scripts/seed-fear-objection-guide.ts
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const HUB_PATH = path.join(process.cwd(), "content/academy/classroom-hub.json");
const SECTION_ID = "client-acquisition-step-6-sales-calls";
const COURSE_ID = "client-acquisition";
const LESSON_ID = "client-acquisition-client-closing-fear-objection";
const INSERT_BEFORE = "client-acquisition-client-closing-universal-closes-final-moves";

const TITLE = "Handling The Fear Objection";

const BODY = `The final boss of objections. Everything checks out — they believe in it, they have the money and the time — but they still can't say yes. Fear isn't rational, so proof alone won't fix it. This guide gives you nine reframes to help a frightened prospect think clearly again, each in its own expandable section.`;

const GUIDE = `## Why fear is different

Sometimes everything aligns at the end of a call: the prospect believes in the process, the money is there, the time is there, there's no partner to consult — and they still can't move. That's fear, and it makes this the hardest objection of all, because you're not up against a reason. You're up against the prospect themselves.

They usually *know* that saying yes is the right move. But stepping outside the comfort zone — for the first time, or again after being burned — feels worse than staying stuck. The devil they know wins.

That's why stacking case studies, conviction and guarantees on top of a frightened person doesn't work. Fear is irrational; you can't out-evidence it. The only way through is to help them **rationalise the emotion, one calm step at a time** — with genuine empathy, because scripts without care just sound like pressure.

Remember: if they truly didn't want this, they'd have ended the call already. They want it. They're looking to you to help them find the confidence to choose it.

## The two roots of fear

Every fear objection grows from one of two roots:

- **Fear of the past** — they've been burned before. Common in experienced buyers.
- **Fear of the future** — they've never done anything like this. Common in first-time investors.

Work out which one you're dealing with early; it decides which reframes will land.

## How to use these reframes

Treat the nine tracks below as **signposts, not a sequence**. Follow the natural flow of the conversation; dig where the conversation takes you; only reach for the next track when you're genuinely stuck or you feel the shift and want to finish well. Jumping mechanically from script to script reads as tactics, and tactics kill trust.

And be patient. Fear conversations run long — that's normal. If an extra half hour on a call genuinely changes the direction of someone's life, it's time well spent.

<details class="lesson-accordion">
<summary>1. The Guarantee Reframe</summary>

**When:** they believe the process works, but doubt it will work *for them*. If you offer any kind of guarantee, this is the moment for it — not the pitch. A guarantee is to fear what a payment plan is to money: a card that only works if you haven't already played it.

**The move:**

1. Confirm the fear gently: *"So you believe this works — you've seen it work for others — you're just hesitant it might not work for you. Is that right?"*
2. Future-pace the certainty: *"If you knew you couldn't fail — genuinely guaranteed to get there — how would you feel?"* Let them describe it.
3. Check the work ethic: *"And knowing that, would you back yourself to put the effort in?"* (If they hesitate here, that's the real concern — explore it first.)
4. Only now reveal it: *"I rarely bring this up because nobody ever needs it — but would it help if I told you how our guarantee works?"* Then state it plainly.

You've now closed every exit except forward. If their voice lifts — that weight-off-the-shoulders shift — close. If they ask to see the terms, don't email them: share your screen and walk through them live, focusing only on the part that matters to them. (See the contract walkthrough in Universal Closes & Final Moves.)
</details>

<details class="lesson-accordion">
<summary>2. The Never Invested Reframe</summary>

**When:** first-time investors — fear of the future. They've never spent this kind of money on themselves, and it shows.

**The move:** normalise the nerves, then walk their own logic to its conclusion:

1. *"Have you ever invested this kind of money in yourself before?"* (or, for self-doubt: *"Have you been successful in other areas of your life — career, sport, study?"*)
2. *"So this feeling is just newness, not evidence. Mind if I offer another perspective?"*
3. The core idea, in your words: **we make decisions from the perspective we have — but change only comes from deciding like the person we want to become.**
4. Then the question ladder, letting them answer each one: Are you fully happy with where the business is now? … Did your decisions to date create that position? … Do you want that same decision-making pattern running the next five years? … Why not? … So what kinds of decisions does the version of you at [goal] make? … And how long do you want to wait before you start making them?
5. Finish simply: *"So what do you think we should do?"*

If they stall with "I still need to sleep on it": *"The version of you already at [goal] — when they see a clear, protected path to something they want, do they sleep on it, or act? And if that's who you're trying to become, what does this moment call for?"*
</details>

<details class="lesson-accordion">
<summary>3. The Burned In The Past Reframe</summary>

**When:** fear of the past — they've bought programmes or services before and it went badly.

**The move:** never skate over the old wound; open it carefully and treat it.

1. Ask about the experience directly (or if you only suspect it: *"Are you hesitant because you've tried something like this before and it didn't work out?"*). Get the detail — what specifically failed?
2. Address that exact failure: explain concretely how your process handles it differently. Then invite scrutiny both ways: *"Where do you see similarities with what we do? And where do you see differences — did they sit down with you like this and actually try to understand whether they could get you there?"*
3. Name the fear out loud: *"Can I share what I think is happening? You're worried this could be a repeat — that we're not who we say we are. Is that fair?"* Naming it releases the pressure of it.
4. Then the turn: *"So — given those past experiences, what made you book this call?"* Their answer is always some version of *hope that someone real exists*. Follow with: *"And what would that company look like?"* — they'll describe you.
5. Close on the choice: *"So the real question is whether you let that old experience keep making your decisions. Do you want it to? … Why not? … Then what should we do?"*
</details>

<details class="lesson-accordion">
<summary>4. The Toxic Ex Reframe</summary>

**When:** burned-in-the-past prospects the direct route didn't move. This is the same reframe delivered as an analogy — sometimes a story lands where logic bounced.

**The move:** ask (flag it as a curveball) whether they're married or have a partner, get the name, then: *"Was [name] the first person you ever had a relationship with?"* Almost always no. Then make the point in your own words: after the relationship that ended badly, they didn't swear off people forever — and because they kept going, they found the person they're with now. Getting burned in business is no different. The experience was real, and it hurt — but the only question that matters is whether it gets to decide the future. *"Are you willing to let it? … Why not? … So what should we do?"*
</details>

<details class="lesson-accordion">
<summary>5. The Fear of Spending Money Reframe</summary>

**When:** the prospect believes they can get there on their own, free — YouTube, blogs, trial and error. Blunt tool: warm tone required, and use it to **reframe, not to close**. It opens an honest conversation; it doesn't finish one.

**The move:** hold up the mirror of their own business.

1. *"You're planning to charge your clients [X] for your services, right? And you're hesitant to invest in yourself because you think you might manage without help?"*
2. Ask permission for a blunt question, then: *"Why would someone invest [X] with you if you weren't willing to invest in yourself to be able to deliver it?"*
3. When they say they'll learn it free: *"Imagine we'd built everything off free YouTube material instead of a track record — would you be more or less likely to invest with us? … Why? … Do you think your prospects feel any differently about you?"*
4. Their own answers make the argument. Then step outside the frame: *"Can we talk person to person for a second? The way you feel right now is exactly how your prospects will feel — except you won't have a track record yet. So what's really going on? That's the conversation I want to have."*
</details>

<details class="lesson-accordion">
<summary>6. The "What Would You Do?" Reframe</summary>

**When:** deep into a fear standoff — especially powerful with prospects who sell for a living. Requires total conviction in delivery or it falls flat.

**The move:** put them in your chair. In your own words: *"If you were me right now, what would you do? You're sitting across from someone who's a perfect fit — you know exactly how you'd get them to their goal, they have the time and the money, and you know they'd succeed. But a little hesitancy means they might never live that version of their life. Honestly — what would you say to them?"*

Most answer: *"I'd tell them to do it."* Then simply: *"So what do you think we should do?"*

If they'd "let them think about it", tell the truth with warmth: you can't do that — you'd be letting fear cost them something you know you can deliver. Stepping outside the comfort zone isn't a nice-to-have; it's the prerequisite of the goal they described. Then make it binary: *"Are you willing to let a bit of fear stop you living the version of your life you just described? That's genuinely a yes-or-no question."* A no is your close. A maybe means switch tracks. A yes — rare, and sad — means you release; you can't want it more than they do.
</details>

<details class="lesson-accordion">
<summary>7. The Role Model Reframe</summary>

**When:** mild fear plus an insistent "I just need to think about it." Instead of comparing the prospect to their future self, compare them to people they already admire.

**The move:** ask who they look up to in business — let them name their own heroes, or offer big obvious ones. Confirm why: those people have achieved what the prospect wants, many times over. Then the point: people at that level are drowning in demands, yet when they find a solution to the thing blocking them, they move on it immediately — that speed *is* the difference. *"So if the goal is to build what they've built — where do you think we go from here?"*
</details>

<details class="lesson-accordion">
<summary>8. The Fear Of Missing Out Reframe</summary>

**When:** "I've got other calls lined up" — they're afraid of committing before seeing every option.

**The move:** first, *"Have you had any of those calls yet?"* If yes, explore honestly what they liked and didn't, and create separation on the differences. If no:

1. Re-tie: *"Do you genuinely believe this is the answer for you — that this gets you to [goal]?"*
2. If yes, the committed-relationship analogy in your own words: when you've already found exactly what you were looking for, you don't keep shopping to make sure nothing better exists — you commit, because risking what's right in front of you *is* the loss. *"So — shall we do this?"*

Honesty check: this only works on a prospect who is already bought in. If they're not, don't force it — go for a deposit and a booked follow-up instead (see the Money guide's deposit track).
</details>

<details class="lesson-accordion">
<summary>9. The "Time Until First Client" Fear</summary>

**When:** money is handled, but they're scared the *future* payments depend on results arriving fast: "If I don't sign clients in the next few months I can't cover the rest."

**The move:**

1. Isolate it: *"So you've got the funds to start and cover the first payment — the concern is covering month two onwards. Is that right?"*
2. Trial-close on the fear itself: *"Would you move forward today if you knew you didn't need to worry about that — that you'd have clients signed by then?"*
3. If yes, bring **specific, relevant proof**: clients like them, and how long their first results took. This one lives or dies on preparation — know your best case studies cold, including realistic timelines.
</details>

## Two look-alikes that aren't fear

- **"I never make decisions on the day"** — usually a decision-making *rule* born from an old bad experience. The curiosity response for it is in **Find The Real Objection**.
- **"The other option is cheaper"** — a value comparison, not a fear. The "Why aren't you going with them?" close is in **Universal Closes & Final Moves**.

## The mindset to hold

Fear conversations are won with patience, empathy and calm — never with volume. You're not overcoming an argument; you're lending someone your confidence until they can find their own. If the call starts to feel more like coaching than selling, you're doing it exactly right.`;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const supabase = createClient(url, key);

  const hub = JSON.parse(fs.readFileSync(HUB_PATH, "utf8")) as {
    courses: Array<{
      id: string;
      sections: Array<{ id: string; lessons: Array<Record<string, unknown>> }>;
    }>;
  };
  const section = hub.courses
    .find((c) => c.id === COURSE_ID)
    ?.sections.find((s) => s.id === SECTION_ID);
  if (!section) throw new Error("section not found");

  if (!section.lessons.some((l) => l.id === LESSON_ID)) {
    const lesson = {
      id: LESSON_ID,
      title: TITLE,
      duration: "",
      hasVideo: false,
      academyUrl: "",
    };
    const idx = section.lessons.findIndex((l) => l.id === INSERT_BEFORE);
    if (idx === -1) section.lessons.push(lesson);
    else section.lessons.splice(idx, 0, lesson);
    fs.writeFileSync(HUB_PATH, `${JSON.stringify(hub, null, 2)}\n`);
    console.log("hub json: lesson inserted");
  } else {
    console.log("hub json: lesson already present");
  }

  const { error } = await supabase.from("academy_lesson_content").upsert(
    {
      course_id: COURSE_ID,
      lesson_id: LESSON_ID,
      title: TITLE,
      body_markdown: BODY,
      guide_markdown: GUIDE,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,lesson_id" },
  );
  if (error) throw new Error(error.message);
  console.log("content upserted:", LESSON_ID);
}

void main();
