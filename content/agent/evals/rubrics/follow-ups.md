---
id: campaign.followups
title: Follow-up messages
pass: 70
---

# Follow-up messages (after they connect)

The messages that follow an accepted connection. Every one gives something; none just "checks in". Message 1 is short (under 300 characters), thanks them, names one problem owners like them describe and asks if it is true for them. Later messages bring one insight with a number, one useful thing (a tool, a benchmark, the BOSS Scorecard after they reply), then a polite close that leaves the door open. Messages under about 300 characters get more replies.

The whole sequence is scored as one piece. Quote the message number in your evidence.

## Criteria

### gives_value | weight 3 | Every message gives something
5: Each message brings something new: an owner problem in their words, an insight with a number, a tool, a benchmark, a question about them. Nothing is a bare nudge.
3: Most give something, one or two are nudges or repeats.
1: Mostly "checking in", "following up", or repeating the connection note.

### short | weight 2 | Short enough to read on a phone
5: Message 1 under 300 characters, the rest short (two to five lines). One idea each.
3: One or two long messages.
1: Long walls of text, or the pitch crammed into message 1.

### one_question | weight 2 | One clear question each
5: Each message ends with one easy question (often yes/no or A/B) about them.
3: Some stack two questions or end without one.
1: Questions stacked, or none at all.

### about_them | weight 2 | About the owner, not the coach
5: Talks about the owner's problems and results. The coach's proof appears briefly as a reason to believe.
3: Balanced, with some long passages about the coach.
1: Mostly about the coach, their system or their story.

### no_hard_sell | weight 2 | Builds interest, does not sell coaching
5: Sells interest in the outcome. The ask grows slowly (question, then a resource, then a short call). Never "coaching" as the ask, never pushy.
3: One premature call ask or "would you like to discuss how I can support you".
1: Pushes a call or coaching from the first message, or uses pressure.

### progression | weight 1 | Builds and closes well
5: A clear arc from problem to insight to resource to a polite close that leaves the door open and moves them to nurture.
3: Arc unclear or messages could be in any order.
1: Repetitive, or ends abruptly with a guilt trip.

## Checked in code

- `length`: penalty when message 1 is over 300 characters; penalty for any message over 700 characters.
- `banned_phrases`: penalty for "just checking", "just following up", "did you see my last message", "as I mentioned in my connection message" (many invites go out blank), "Free Coaching Discovery Call", fake scarcity, "other coaches".
- `tokens`: gate on tokens nothing fills.
- `launch_check`: Ava's sequence must pass the same pre-launch check coaches see in the campaign editor (blockers are gates, warnings are penalties).
- `em_dash`: penalty.
- `invented_numbers`: gate when a number is not in the coach's facts (Ava only).

## Examples

### Strong
Message 1: Thanks for connecting, {first_name}. A lot of M&E MDs tell me they're winning plenty of work but can't see which jobs make money until month-end. Is that true for you too?

Message 2: One number I always check first: labour cost against the price on the last five jobs. At Harlow & Pike that view alone helped us grow from £4.2m to £11.8m without losing margin. Have you looked at yours lately?

Message 3: If it's useful, there's a 3-minute BOSS Scorecard that shows which part of the business is capping profit. Want me to send it over?

Message 4: I'll leave it there, {first_name}. If margin or cash ever becomes the thing keeping you up, drop me a line. Happy to help.

### Weak
Message 1: Hi {first_name}, thanks for connecting! As I mentioned in my connection message, I'm a business coach with over 20 years of experience helping businesses grow through my proven system which covers strategy, leadership, sales, marketing, operations and finance. I'd love to book a Free Coaching Discovery Call to discuss how I can support you. Would Tuesday or Wednesday work?

Message 2: Hi {first_name}, just checking you saw my last message?

Message 3: Hi {first_name}, I only have a few slots left this week. Let me know!
