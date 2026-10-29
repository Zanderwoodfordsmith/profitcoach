---
id: campaign-messaging
title: Campaign messaging
summary: Write or rewrite a campaign's sequence, or bring in the messages from the coach's Practice Blueprint.
tools: [get_campaign, get_coach_brain, use_blueprint_messaging, write_campaign_steps]
references: [ai-knowledge/writing-rules.md, ai-knowledge/copywriting-method.md, practice-skills/_shared.md, practice-skills/connection-campaign.md, practice-skills/connection-campaign/note.md, practice-skills/connection-campaign/follow-ups.md, practice-skills/campaigns.md, practice-skills/nurture.md, ai-knowledge/outreach-research.md]
modes: [admin, coach]
---

# Campaign messaging

## What this is
The words a campaign sends: the connection request note, then wait and message steps. You write them in the coach's voice, for their avatar, with their real proof. Match the kind of coach they are (boot camp, hugs, a mix). Connection notes stay short and proof-led: word choice only, no hobbies or stories. Reactivation and ongoing nurture have more room: "what I do now" and nurture messages can use a story, book, film or hobby they named on Your Voice. Never invent one.

## Inputs
- Reads: the campaign (`get_campaign`), and the coach brain with the Blueprint's campaign messaging (`get_coach_brain`).
- References: `writing-rules.md`, `copywriting-method.md` (think first, then write), `_shared.md`, the connection campaign skill (`connection-campaign.md`, with `note.md` and `follow-ups.md`: the Classroom lesson, Zander's reviews of real notes and the recommended sequence), `campaigns.md` (messaging and reactivation), `nurture.md`, and `outreach-research.md` (what 110,000 of our coaches' connection requests showed).
- From the coach: which campaign, and what they want changed.

## Before you write
1. `get_campaign` for the current steps and channel.
2. `get_coach_brain` for the ideal client, pain language, proof and the blueprint's campaign messaging. If the blueprint already has the campaign written, prefer it: `use_blueprint_messaging` puts it into the campaign as it is. Pick the one that matches the campaign: connection (new 2nd and 3rd degree owners), messaging (connections who fit but have never spoken), reactivation (people they already know), nurture (not ready yet) or reply_interested (said yes). Rewrite only when they ask for something different.
3. If there is no real proof (a client result with a number), say so and leave a clear placeholder in square brackets. Never invent a result, a client or a number.
4. For a connection campaign, follow the recommended campaign in `connection-campaign.md`: a proof note (or a tribe note when there is no real number), never a link. If they ask about a blank invite, give the trade-off with its caveat: no note gets more accepts, a proof note tends to get more meetings.
5. Before you show any copy, run the checks in section 7 of the copywriting method and the 10-step checklist in `note.md`, and fix what fails.

## Questions about what works
When they ask what works in outreach (note or no note, acceptance or reply rates, who answers, how fast to reply), answer from `outreach-research.md` in a few short bullets, with the caveat that fits and one thing to try. No tools needed.

## Sequence shape (connection campaign)
- Step 0 `invite`: the connection note, following `note.md`. 300 characters or under, counting first name as 10 and company as 30. Can be blank for the softer conversation campaign.
- Then pairs of `wait` and `message`, as in `follow-ups.md`: message 1 in the ad shape after 1 hour, then 1 day, 2 days, 4 days and 2 weeks.
- Follow-up messages go on `remind` (the coach approves each before it sends) unless they ask for auto.
- Use merge fields exactly: `{{first_name}}`, `{{company}}`, `{{title}}`, `{{location}}`.

## The process
1. Draft in the chat first: show the messages, short, numbered, with the wait before each.
2. When they are happy (or asked you to just do it), save with `write_campaign_steps`. It replaces the whole sequence.
3. Say what changed and that nothing sends until the campaign has people and is turned on.

## Confirmation
Rewriting the steps of a **running** campaign asks for confirmation, because people are part-way through it. Drafts and paused campaigns save straight away.

## What NOT to do
- No em dashes. No "transform", "unlock", "game-changer". No "I hope this finds you well".
- Do not sell coaching in the first message. Ask about their outcome.
- Do not let the invite note pass 300 characters, counting first name as 10 and company as 30. Count.
