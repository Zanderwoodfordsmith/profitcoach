---
id: reply.draft
title: Reply to a prospect
pass: 70
---

# Reply to a prospect

A reply the coach can send back to an owner who answered their outreach. It follows the situation's play (interested, a question, not now, fine for now, no thanks, an objection, gone quiet, scorecard done). Rhythm: acknowledge, give something, one question. Never sells coaching; builds interest in the outcome, then the BOSS Scorecard, then a short call.

The case tells you the situation and the next step BCA expects. Judge the reply against that.

## Criteria

### right_move | weight 3 | Takes the right next step
5: Does exactly what the situation needs (for example: interested and vague, offers the BOSS Scorecard; asked the price, answers honestly then asks one question; not now, stays useful without guilt; picked a time, confirms it). One clear next step.
3: A reasonable move but not the best one (jumps to a calendar link when the scorecard fits, or answers but gives no next step).
1: The wrong move (pitches when they said no, ignores their question, books a call they did not ask for).

### acknowledges | weight 2 | Shows they listened
5: Reflects what the prospect actually said, in their words, before moving on. Empathy first on objections, with no "but".
3: A generic acknowledgement ("Thanks for getting back to me").
1: Ignores what they said.

### short_human | weight 2 | Short and human
5: Two to four short lines. Sounds like a person on LinkedIn, not a template or a sales email.
3: A bit long or a bit stiff.
1: A wall of text, or obviously automated.

### one_question | weight 2 | One question, easy to answer
5: At most one question, and it is easy to answer (yes/no or A/B), or a clear statement of what happens next.
3: Two questions, or a hard open question.
1: Several stacked questions.

### no_pressure | weight 1 | No pressure, no hype
5: No fake urgency, no hard sell, no coach-speak, no "pick your brain" or "circling back".
3: A small push.
1: Pushy, guilt-tripping or salesy.

## Checked in code

- `length`: penalty over 600 characters for LinkedIn.
- `questions`: penalty for more than two question marks.
- `banned_phrases`: penalty for "pick your brain", "coffee chat", "circling back", "just checking", "swap ideas", fake scarcity.
- `link_when_not_asked`: penalty for a calendar link when the expected step is not a call.
- `em_dash`: penalty.
- `invented_numbers`: gate when a number is not in the thread, the coach's notes or BCA's own facts (Ava only).
- `injection`: gate when the reply follows an instruction hidden in the prospect's message.

## Examples

### Strong
Situation: interested, vague ("Sounds interesting, tell me more").
That's good to hear, Mark. The quickest way to see if it's worth a proper chat is a 3-minute BOSS Scorecard. It shows which part of the business is capping profit. Want me to send it over?

### Weak
Situation: interested, vague ("Sounds interesting, tell me more").
Hi Mark, thanks so much for getting back to me! I'm a business coach with 25 years of experience and I'd love to jump on a Free Coaching Discovery Call to pick your brain about your goals, discuss your challenges, and explain my 9-step system. Are you free Tuesday? What are your biggest challenges? How many staff do you have?
