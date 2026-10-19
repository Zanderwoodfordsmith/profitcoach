---
id: linkedin.about
title: LinkedIn About
pass: 70
---

# LinkedIn About

When a prospect gets a message, they check the profile to see if the claim is real. The About is a short sales page written to the owner, not a CV. In our data a full About (1,200 characters or more) went with 4 to 6 points higher acceptance.

## Criteria

### hook | weight 3 | Opens on the owner's problem
5: The first two or three lines (the part shown before "see more") name a frustration the target owner has, in their words, so they keep reading.
3: Opens with something relevant but generic, or with the coach's story before the owner's problem.
1: Opens with "I am a...", a career summary, or a quote with no link to the owner.

### written_to_owner | weight 2 | Talks to the owner
5: Mostly "you" and "your", about the owner's world. The coach appears as the person who can help.
3: A mix, with long stretches about the coach.
1: Reads as a CV or biography in the third person or all "I".

### who_for | weight 2 | Clear who it is for
5: The reader can tell in one line whether they are the right fit (sector, size, situation), ideally with a short "this is for you if" list.
3: Audience implied but broad ("business owners").
1: No idea who it is for.

### method | weight 2 | How they fix it, in plain words
5: Explains what the coach actually does with an owner, in plain steps or levers, without jargon. The owner can picture working with them.
3: Names a method or "system" but not what happens.
1: No how, or only buzzwords ("holistic", "transformational journey").

### proof | weight 3 | Specific proof
5: Two or three results with a from, a to and a timeframe (client results best, career results fine), all true for this coach.
3: Proof that is vague ("helped hundreds of businesses grow"), or one result without numbers.
1: No proof, or claims that read as made up.

### personality | weight 1 | Sounds like a real person
5: You can tell what working with them would feel like (direct, warm, no-nonsense). One or two human details that the coach gave.
3: Professional but could be anyone.
1: Corporate or AI-sounding throughout.

### cta | weight 2 | Clear next step
5: Ends with one clear, low-friction next step (take the BOSS Scorecard, connect, send a message, book a short call), with how to do it.
3: A vague invitation ("feel free to reach out").
1: No call to action.

### readability | weight 1 | Easy to read
5: Short paragraphs (one to three sentences), plain words, white space. Lists only where they help.
3: Some long blocks.
1: One wall of text, or bullet soup.

## Checked in code

- `length`: gate over 2,600 characters (LinkedIn's limit); penalty under 1,200 characters; ideal 1,500 to 2,000.
- `em_dash`: penalty.
- `buzzwords`: penalty.
- `discreet_coach_word`: gate when the coach is discreet and the About says "coach" or "coaching" (Ava only).
- `invented_numbers`: gate when a number is not in the coach's facts (Ava only).

## Examples

### Strong
You're winning the work. The lads are busy. Turnover's up. So why isn't the money there at the end of the year?

That's the question I hear every week from MDs running HVAC and M&E firms across the North of England.

It usually comes down to three things: margin bleeding out on jobs before anyone catches it, the MD still fielding every site call, and retentions sitting unpaid for months.

I know those problems because I lived them. As Operations Director at Harlow & Pike I took the HVAC division from £4.2m to £11.8m in five years by moving from one-off installs to planned maintenance contracts and tightening job pricing.

This is for you if:
- You run a building services firm with 10 to 50 staff
- You're busy but the profit isn't landing
- You're the person every decision waits on
- You want a weekly view of every live job

What I do: sit in on your job reviews and pricing, find where the margin goes, then put a simple weekly numbers rhythm in place so you see problems before month-end.

I'm direct. I'll tell you what I see, and I'll be in the numbers with you from week one.

If that sounds like your business, take the 3-minute BOSS Scorecard on my profile, or send me a message and I'll share what I'd look at first.

### Weak
I am a highly experienced business professional with over 25 years of experience across multiple industries. I am passionate about empowering leaders to unlock their full potential and achieve transformational growth. My holistic approach combines strategic thinking with a results-driven mindset. Feel free to reach out.
