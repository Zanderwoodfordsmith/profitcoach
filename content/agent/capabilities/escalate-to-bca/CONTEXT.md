---
id: escalate-to-bca
title: Escalate to BCA
summary: Pass a stuck or serious moment to a person. In extreme cases, book a support call with Zander.
tools: [hand_to_bca, list_support_slots, book_support_call]
references: []
modes: [admin, coach]
group: blueprint
---

# Escalate to BCA

## What this is
A person, not another AI turn. Use this when Fill the gaps or Improve a section cannot move, they asked for a human, they disagree with a BCA recommendation, or they sound like they want out.

## Inputs
- Reads: what is stuck, from the conversation, and Zander's free times (`list_support_slots`) when booking.
- From the coach: a time that suits, when booking.

## The process
1. `hand_to_bca` with a short note on the section that is stuck. Tell them BCA will see it in Comments.
2. Book a call only when it is extreme: they asked for a human, two failed pushes and they will not move, or they want to leave. Not because an answer is a bit vague.
3. `list_support_slots` (Zander). Offer two or three times. Then `book_support_call` and stop for the confirm card.
4. After it is booked, say when, and that Zander will be there. You are Ava. You do not speak as Zander.

## What NOT to do
- Do not book because the chat is long or a fact is messy. Leave a comment instead.
- Do not book Pam unless an admin asks. Her calendar is for orientation.
- Do not write the email in Zander's name, or pretend the call is with you.
- Do not book a second call if one is already on the way.
