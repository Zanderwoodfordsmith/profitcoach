---
id: blueprint-writing
title: Blueprint writing
summary: Research the avatar and pain points, rewrite the LinkedIn profile and headlines, write campaign messaging, the call script and more, using the Practice Blueprint's skills.
tools: [list_blueprint_sections, read_blueprint_section, write_blueprint_section]
references: []
modes: [admin]
---

# Blueprint writing

## What this is
The coach's Practice Blueprint has sections we write for them with AI skills built from the classroom: market options, the avatar, pain points, prospect criteria, the bio, the LinkedIn profile (headline, About, Featured and current role), the campaigns (connection, messaging, reactivation, ongoing nurture, replies and reply interested), the offer, the value session and call script, the LinkedIn newsletter (the issue, then its cover, inbox note, post, InMail and article), posts and the 90-day plan. You run those skills. You do not write these sections yourself. For a conversational newsletter (topic first, then the issue), prefer `linkedin-marketing`.

## Inputs
- Reads: which sections are written (`list_blueprint_sections`) and any section they ask about (`read_blueprint_section`).
- From the person: which section to write or rewrite, and what to change in a draft.
- Their LinkedIn: writers that read it import it themselves, from wherever we already have their address (a saved import, their account, their Blueprint, their connected LinkedIn). Only ask for their LinkedIn address when the tool says none could be found.
- No references: each section's skill carries its own method.

## The process
1. `list_blueprint_sections` to see what is written. Sections are in build order: each builds on the ones before it.
2. Match the request to a section: "research the pain points" is `market:pains`; "rewrite the LinkedIn profile", "the headline" or "the About" is `linkedin:rewrite`; "the bio" is `story:bio`; "who should they target" is `market:criteria` or `market:avatar`.
3. If a section it needs is missing, say so and offer to write that first.
4. `write_blueprint_section`. Tell them it takes up to a minute. It always comes back as a draft on a card in the chat, first time or rewrite: the new text (and what it says now, for a rewrite) with "Save to Blueprint" and "Change it". Nothing reaches the Blueprint until they press Save.
5. The card shows the text, so do not repeat it. In one or two lines say what it used (the result says, for example, which LinkedIn) and flag anything to check, such as two numbers that do not agree or a placeholder still open. Then stop.
6. If they press "Change it", or type a change, ask what to change if they have not said, then `write_blueprint_section` again with `changes` in their words. That makes a new draft from the last one.
7. Once saved, point them to the page. Use `read_blueprint_section` when they ask what a section says.

## What NOT to do
- Do not say a draft is in the Blueprint before they press Save.
- Do not write a section's content yourself in the chat instead of running the skill. The skills carry the classroom method and the no-invention rules.
- Do not draft several written sections in one go without saying which ones first.
- Results with no real number stay as placeholders. A change they ask for never adds a fact (a number, a client, a result) that is not in their Blueprint.
