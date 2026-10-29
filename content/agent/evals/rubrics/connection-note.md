---
id: campaign.connection
title: Connection note
pass: 70
---

# Connection note

The note on a connection request to a new owner (2nd or 3rd degree). It has 300 characters to earn a yes. The classroom shape: "Hi {first_name}," then a specific callout, a desire hook as a question, "I ask because", specific proof with a number and a timeframe, the mechanism, and "Is this of interest?".

## Criteria

### callout | weight 2 | Specific callout
5: Shows it was written for owners like them: names their industry or situation ("I see you run a UK HVAC contracting business").
3: A loose callout ("I see you run a business", "fellow business owner").
1: No callout, or only flattery ("I was impressed by your profile").

### hook | weight 3 | Desire hook as a question
5: Asks about one specific outcome the owner wants, in their words ("Are you looking to know, job by job, where your margin went?").
3: A generic question ("Are you looking to grow?") or a statement instead of a question.
1: No hook, or a pitch.

### proof | weight 3 | Specific proof with a number and a timeframe
5: A real result with a from, a to and a timeframe, tied to the hook (client proof best, career proof fine), plus the mechanism in a few words.
3: Proof without numbers or without a timeframe, or numbers that do not connect to the hook.
1: No proof, or abstract claims ("I help businesses double profits").

### owner_language | weight 2 | Owner words, no coach-speak
5: Sounds like one owner talking to another. Industry nouns. Never sells coaching.
3: Mostly plain with a stock phrase.
1: Coach-speak, or sells coaching or a "free discovery call".

### cta | weight 2 | Soft interest ask
5: Ends with a low-pressure interest question ("Is this of interest?", "Worth a chat?") and no link.
3: A heavier ask (book a call now) or no clear ask.
1: Pushy, or asks for a meeting in the first touch.

## Checked in code

- `length`: gate over 300 characters once filled in (LinkedIn's limit), counting first name as 10 characters and company as 30.
- `greeting`: penalty when it does not open with a greeting and the first name token.
- `link_in_note`: gate. In our data notes with a link were accepted about 40% less often and got a fifth of the interest.
- `tokens`: gate on any token other than {first_name}, {company}, {assessment_url} (or the {{...}} forms the campaign builder fills), and on placeholders nothing fills.
- `banned_phrases`: penalty for "Free Coaching Discovery Call", fake scarcity, "other coaches", "just checking".
- `em_dash`: penalty.
- `invented_numbers`: gate when a number is not in the coach's facts (Ava only).

## Examples

### Strong
Hi {first_name}, I see you run a UK M&E contracting business. Are you looking to know, job by job, where your margin went? I ask because at Harlow & Pike I grew the HVAC division from £4.2m to £11.8m in 5 years by fixing job pricing. Is this of interest?

### Weak
Hi {first_name}, I'm a certified business coach helping entrepreneurs unlock their potential. I'd love to connect and offer you a Free Coaching Discovery Call: https://calendly.com/example
