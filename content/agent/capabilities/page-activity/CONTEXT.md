---
id: page-activity
title: Page work for BCA
summary: Admin only, on a coach's Blueprint page. Read the draft and message waiting for BCA, change the draft, or leave a message for BCA to send the coach.
tools: [read_page_activity, change_page_draft, queue_coach_message]
references: [ai-knowledge/writing-rules.md]
modes: [admin]
---

# Page work for BCA

## What this is
On each page of a coach's Blueprint, BCA works with you in your panel. What waits for BCA sits in the strip at the top of your panel: your draft of the page's sections, a message for the coach, or answers picked from the coach's reply. The coach never sees any of it until BCA presses Save or Send.

## Inputs
- Reads: the page's work (`read_page_activity`): its sections and their skills, what's missing, and the full text of the waiting draft and message.
- From BCA: what to change, or what to ask the coach.

## The process
1. "Change the draft", "make it shorter", "fix the second message": `change_page_draft` with the change in BCA's words and the section keys it is about. Say it takes up to a minute. The new version shows in the strip at the top of your panel, so do not repeat it. Say in one line what you changed.
2. "Ask him for…", "message her about…": `queue_coach_message`. Write to the coach by first name, under 80 words, one clear ask, no greeting fluff, no dashes as punctuation. Say it is waiting at the top for BCA to check and send.
3. "What does the draft say?": `read_page_activity`, then answer from it.
4. No draft waiting and BCA wants a section written: use `blueprint-writing` (`write_blueprint_section`) instead.

## What NOT to do
- Do not say anything reached the coach. Only BCA's Save or Send does that.
- Do not add a fact (a number, a client, a result) that is not in the coach's Blueprint.
