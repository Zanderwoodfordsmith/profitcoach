---
id: check-blueprint
title: Check it together
summary: Walk the coach through their Blueprint on the page beside you, one page or section at a time. Ask if they are happy, make the changes they want, then move on.
tools: [blueprint_overview, read_section, show_section, save_answer, clear_answer, propose_copy, undo_copy, sign_off_section, hand_to_bca]
references: [agent/references/blueprint-quality.md, code:blueprint-blocks, ai-knowledge/writing-rules.md]
modes: [admin, coach]
group: blueprint
---

# Check it together

## What this is
The second half of filling in the Blueprint. The answers are in (from Fill the gaps or the call). Now you take the coach through it on the page itself, so they read it where it lives and know it is right. A few minutes, not a form. There is nothing for them to click: their yes in the chat is the sign-off.

## Inputs
- Reads: the Blueprint and its sections (`blueprint_overview`, `read_section`), and the page they are on (working state).
- References: `blueprint-quality.md`, the Blueprint block format, `writing-rules.md`.
- From the coach: a yes, or the change they want, one section at a time.

## The process
1. `blueprint_overview` to see what there is. Start with the page they are on if it has something to check, otherwise About You (Story and Proof, Your Voice, Practice Setup), then any written section waiting on them for review. Skip empty sections and anything waiting on BCA.
2. `show_section` for the page or section, then one short line: "Have a quick look over your Results. Happy with that, or anything you'd change?" Use `read_section` first if you need to know what is there. A short page can be checked whole; a long one, a section at a time.
3. If they want a change, make it, then `show_section` on it again so it lights up, and ask "Right, are we good now?"
   - **Their answers:** `save_answer` with their new words and `replace: true`. To remove one item from a list, save the rest. To remove a whole answer, `clear_answer`.
   - **Copy BCA wrote:** `propose_copy` with the whole section. It shows as a draft card with "Save to Blueprint" and "Change it"; it goes in when they press Save. If they prefer the old one after saving, `undo_copy`.
4. When they say yes (or "fine", "looks good", "move on"), `sign_off_section` with their words, for each section on what they just checked. Do not make a thing of it. Move to the next one.
5. If they want BCA's view, or a fact will not firm up after two tries, `hand_to_bca` and carry on.
6. At the end, one line on where they are: what is signed off, and what BCA does next.

## How it should feel
- Quick. One section, one question, then on. Do not read the section back to them; it is on the page.
- They lead. If they want to skip something, skip it and come back at the end. If they say a whole page is fine, sign off every section on it.
- Never sign off something they did not say yes to.

## What NOT to do
- Do not change a fact unless they give you the new one. Copy you may rewrite; their answers only change in their words.
- Do not sign off sections waiting on BCA, or anything they have not looked at.
- Do not turn it back into the questions. If a section is still empty, ask for it there and then only if it is quick; otherwise note it and offer Fill the gaps at the end.
