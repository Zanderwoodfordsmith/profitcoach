# Ava in the Blueprint: review

Built 17 Oct 2026 on branch `coach-website`, local only. Nothing is committed or pushed.

## What to open

Run the app on 3002 as usual.

- **As a coach:** any Blueprint page, for example http://localhost:3002/coach/blueprint/story. Click **Ask Ava** at the top right.
- **As admin, on a coach:** http://localhost:3002/admin/blueprint/coach/story (Zander Demo is the default).

The right-hand panel now has two tabs:

| Tab | Who answers | Looks like |
|---|---|---|
| **Ava** | The AI, straight away | Chat bubbles |
| **Comments** | People (you and the coach), when they get to it | Cards, one conversation per section |

## What Ava does

One Ava, built on the agent we already had. The old "Talk it through" interview is now one of her skills.

- **Starts where you are.** On the Story page she offers "Fill the gaps on Story · 2 open". If that page is done, "Keep filling in my blueprint", plus "Check my Story page".
- **Fills the gaps.** One question at a time, saves each answer the moment it is given, and shows a small green "Saved to Story · Results" under it. The Blueprint updates live behind the panel.
- **Kind, and honest.** A vague answer gets a gentle push for numbers, never a save. Two pushes at most, then she saves what there is and passes it to BCA in that section's Comments.
- **Never changes facts.** Answers only ever come from the coach's own words (the save tool won't run without them quoted). Replacing an existing answer needs a new answer from the coach.
- **Improves copy, by proposal.** For sections BCA wrote (bio, avatar, messages, scripts) she drafts a new version on a card: **Use this version** or **Keep mine**. Nothing changes until it is accepted. Prospect-facing sections still go back to BCA for sign-off after.
- **Follows you.** A conversation can move across sections and pages.
- **Titles every conversation** from what it covered ("Client results and a proud career moment") and renames it as it moves on.
- **History.** Every conversation, newest first. As admin you see the coach's conversations too (read-only, marked with their name). Old "Talk it through" conversations are there under "Earlier".
- **Voice.** "Speak" on the box, same as before.

## Tested on Zander Demo (real model, real data)

1. "Let's fill the gaps on the Story page." Ava opened Fill the gaps, found the two open Story questions, asked the first with an example. Title: "Story page gaps: client results".
2. "I helped a manufacturer improve their cash flow massively." She said owners trust numbers, not adjectives, asked for rough before and after figures, and **saved nothing**.
3. Gave real numbers. She saved it to Commercial achievements in the coach's words, showed "Saved to …", moved to the next question, and retitled the chat. The existing career result was untouched.
4. "Can you tighten my short bio?" She opened Improve a section, read the bio, and put a shorter version on a card ("Nothing changes until you accept it"). She also spotted that the bio says "Operations Director" while the proof table says "Division Leader", and asked which is right rather than picking one. I left the card unaccepted, so the bio is unchanged.

I put Zander Demo's client stories back to how they were after the test.

## Decisions I made (overturn any of these)

1. **Every coach gets Ava's Blueprint skills** (Fill the gaps, Improve a section). Campaigns, lists and imports still need the agent switched on per coach, as before. The app-wide AI panel is unchanged for coaches without it.
2. **Buttons say "Ask Ava"** and the tab says "Ava". "Talk it through" is gone from the Blueprint.
3. **Ava's notes in Comments count as unread for both sides**, so a hand-over to BCA gets seen, and a nudge to the coach does too.
4. **Enter sends** in the Ava box (Shift+Enter for a new line), like any chat. In Comments it is still ⌘ Enter, because comments tend to be longer.
5. **Coaches can't ask Ava to write a section from scratch**; that stays with BCA (admins can, from the app-wide panel or here). Coaches can improve anything already written.
6. **Titles use the small, cheap model** (Haiku 5.5). The conversation itself uses the agent's model (Opus 5.5).
7. **The panel is shared with the app-wide AI panel's engine**, so the same Ava and history appear in both.

## Not done yet

- **Per-section "Work on this with Ava" button.** For now you ask from the panel ("check my results").
- **Cost per coach.** Each Ava turn runs on Opus 5.5. Fill the gaps could run on a cheaper model; worth measuring once a few coaches use it.
- **Ava proactive nudges** (the background plan). The pieces are ready: she can already post to Comments.
- **The app-wide AI panel still says "What should I do?"** rather than introducing Ava by name.
- The old interview API and `BlueprintAssistant` component are still in the code, unused by the Blueprint, in case you want them back.

## Where things live

- What Ava is and how she talks: `content/agent/AGENT.md`
- Her two new skills: `content/agent/capabilities/fill-the-gaps/` and `improve-section/`
- The quality bar she holds answers to: `content/agent/references/blueprint-quality.md` (edit this to change what "good" means)
- Her Blueprint tools: `src/lib/agent/tools/blueprintAva.ts`
- The panel: `src/components/practice/ava/AvaPanel.tsx`
