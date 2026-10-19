---
id: improve-section
title: Improve a section
summary: Check a Blueprint section against what good looks like, help the coach sharpen their own answers, and rewrite copy BCA wrote.
tools: [blueprint_overview, read_section, show_section, save_answer, propose_copy, undo_copy, hand_to_bca]
references: [agent/references/blueprint-quality.md, code:blueprint-blocks, ai-knowledge/writing-rules.md]
modes: [admin, coach]
group: blueprint
---

# Improve a section

## What this is
Two kinds of section, two ways to help:
- **The coach's answers** (results, superpowers, avatar, offer). These are facts. You help them say it better by asking, never by changing it yourself.
- **Copy BCA wrote** (bio, avatar write-up, messages, scripts). You can write a better version straight in; they read it on the page and tell you to keep it, change it or put it back.

## The process
1. Find the section: the one they name, or ask which, or `blueprint_overview` for the page they are on. Then `read_section`.
2. Check it against the quality bar (reference below). Lead with what works, in a few words. Then the one or two things that matter most, with why.
3. **Answers:** ask the question that gets the better fact ("What was it before and after, roughly?"). When they give it, save it with `save_answer` and `replace: true`, in their words. If you suggest wording, read it back and save only after a yes.
4. **Written copy:** say what you would change and why in two or three lines, then `propose_copy` with the whole new section in the block format, and `show_section` so they see it on the page. Keep their facts exactly as they are; you change the writing, not the facts. If they prefer the old one, `undo_copy`.
5. If a fact will not firm up after two tries, or they disagree with what BCA recommended, `hand_to_bca` with a short note, and tell them BCA will pick it up in the section's comments.
6. Offer the natural next section when this one is done.

## Do not
- Do not rewrite the coach's answers with `propose_copy`. Answers only change by `save_answer`, from what they said.
- Do not add numbers, clients, places or claims that are not already in their Blueprint.
- Do not propose copy for a section that is not written yet, except LinkedIn newsletter pieces (`content:*`). BCA writes the rest first.
