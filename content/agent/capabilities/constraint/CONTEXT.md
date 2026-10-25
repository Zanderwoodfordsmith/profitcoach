---
id: constraint
title: Constraint
summary: Find the one stage holding them back most, from their own numbers, and the one job that fixes it.
tools: [get_funnel_numbers]
references: []
modes: [admin, coach]
---

# Constraint

## What this is
For "what's holding me back", "where am I stuck", "what's my constraint" and "why am I not getting clients". The constraint is the one stage in their client journey that holds them back most. You find it from their real numbers, show the numbers in plain words, and offer the one job that fixes it.

The journey has six stages:

1. **People in campaigns.** Enough people going in and invites going out.
2. **Invites accepted.** People say yes to the connection.
3. **Replies.** People who accepted write back.
4. **Calls booked.** Replies and interest turn into calls.
5. **Clients.** Calls turn into clients.
6. **Time to deliver.** They have room for more clients.

## Inputs
- Reads: `get_funnel_numbers`. It returns the numbers, the stage the rules pick, the capability to open next, what it could not judge yet, and what data is missing.
- From the coach: nothing to start. Ask only to check a number the tool flags.

## The rules
The tool applies these. They are here so you can explain them, and so BCA can tune them (the same numbers live in `CONSTRAINT_RULES` in `src/lib/agent/tools/constraint.ts`; change both together).

Delivery comes first, because more clients cannot help someone who is full. Then the stages are checked from the bottom up: the stage furthest along that has enough people reaching it and still fails is the narrowest point. More people at the top would only pile up there. A stage with too few people to judge is passed over.

| Stage | Judged when | Stuck when | Opens next |
|---|---|---|---|
| Time to deliver | Capacity is in the Blueprint | Clients in their list ≥ capacity | `improve-section` (the Offer) |
| Clients | 5 or more calls booked in 90 days | No new client in 90 days | `personalised-pitch` |
| Calls booked | 10 or more replies, or 3 or more interested, in 30 days | No call booked in 30 days | `campaigns` (Positive replies) |
| Replies | 30 or more people accepted, of those invited in 30 days | Under 5% of them replied | `campaign-messaging` |
| Invites accepted | 100 or more invites in 30 days | Under 10% accepted (the 110k-invite review averaged 12% to 18%) | `campaign-messaging` |
| People in campaigns | Always | LinkedIn not connected, no running campaign, under 200 people waiting for an invite, or under 200 invites in 30 days (aim for about 100 a week) | `guide`, `campaigns` or `find-prospects` |

If nothing is stuck, say so, and say that more people in campaigns grows every number after it.

How the numbers are counted (the same as Admin → Client success → Get clients): invites are invite steps sent in the last 30 days; accepts and replies are what happened to those same people; "replies" for the calls stage counts anyone who replied or was marked interested in the last 30 days; calls are prospect calls booked in the app or the BCA calendar, not cancelled; clients are people in their client list, won by their start date.

## The process
1. Call `get_funnel_numbers` once. In admin mode, say whose numbers they are.
2. If `check_first` is set, ask that one question before you name the constraint. Example: "I can't see any calls in the app. Do you book them somewhere else?" If they do, the number is wrong: say what you can and cannot judge, and do not name that stage.
3. Name the constraint in one line, then the numbers behind it in two or three short bullets. Use their numbers and plain words: "You invited 384 people in the last 30 days. 2 accepted." Not rates on their own, and no jargon.
4. Say why this stage matters most in one sentence. Example: "19 people said they were interested and none booked a call, so more invites would only add to that pile."
5. Offer the one job from `next_job`, and offer to open the capability in `open` now. Open it only when they say yes.
6. If they ask about the other stages, show `not_judged` in plain words ("Too early to judge replies: only 12 people have accepted so far").

## What NOT to do
- Do not guess when data is missing. Say what is missing (`missing`) and what it means: "Your capacity isn't in your Blueprint, so I can't tell if you're full."
- Do not name more than one constraint. Other weak numbers can wait.
- Do not change the stage the tool picks. If you think it is wrong, say what you see and why.
- Do not blame the coach. Say what the numbers show and what to do next.
- Do not start the fix as part of this job. Offer it, then open the capability when they agree.
