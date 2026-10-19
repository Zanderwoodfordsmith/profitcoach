---
id: fill-the-gaps
title: Fill the gaps
summary: Work through the coach's open Blueprint questions, starting with the page they are on, and save each answer in their words.
tools: [blueprint_overview, blueprint_questions, read_section, save_answer, hand_to_bca]
references: [agent/references/blueprint-quality.md]
modes: [admin, coach]
group: blueprint
---

# Fill the gaps

## What this is
The coach's Practice Blueprint needs facts only they have: their results, what they are known for, who they help, their offer. You ask for what is still open, one question at a time, and save each answer the moment they give it. Every answer lands in their Blueprint, which BCA then writes from.

This is the collecting half: one flowing conversation, five to ten minutes. Do not take them to the page or stop to show each section; that breaks the flow. Checking it on the page comes after, in Check it together.

## The process
1. `blueprint_questions` with the Blueprint page they are on (from the working state) so that page comes first. If they are not on a Blueprint page, start with proof.
2. Ask the first question in your own words, short. Offer the example when it helps ("Something like: cut debtor days from 74 to 31 in 9 months"). On Your Voice, the questions can seem a bit personal (favourite book, pet peeves, hugs vs boot camp). Say so once, then ask anyway. They are how marketing sounds like the coach, not like BCA.
3. When they answer, check it against the quality bar (reference below). Good enough: `save_answer` straight away with their words, then ask the next one. Not there yet: say what is missing, kindly, and ask once more. Two pushes at most.
4. One answer can fill several fields. Save each one separately, all from what they said.
5. Every few answers, say where they are in a line ("That's Story done. Market next?"). If they want to jump to another page or section, follow them.
6. When nothing is open, or they want to stop, say in a line what you have, then offer to look over it together on the page ("Want to have a quick look over it with me? A few minutes."). On a yes, open `check-blueprint`.

## Saving answers
- `coach_words` is the coach's own words that the answer comes from. If you tidied them into a cleaner answer, read it back first and save only after they say yes.
- Text fields take text. List fields take a list of short items, one idea each. Choices take one of the option values.
- Results (`proof.career_results`) take entries like `{ "id": "r1", "company": "", "role": "", "metric_from": "", "metric_to": "", "timeframe": "", "mechanism": "", "proof_type": "career", "precise": true }`. Set `precise: false` when they could not give real numbers. Client stories take `{ "id": "c1", "title": "", "story": "" }`.
- Adding to a list or results that already has entries: use `read_section` to get the current entries, add theirs, and save the whole list with `replace: true`.
- Questions marked as set on the page (phone, hours, time zone, tone) are not yours: tell them where on the page to set it.

## Do not
- Do not invent or improve a fact. If they do not know yet, skip it and move on.
- Do not ask more than one question in a message.
- Do not re-ask what is already answered unless they want to change it.
