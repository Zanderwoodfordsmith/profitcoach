---
id: linkedin.experience
title: LinkedIn current role
pass: 70
---

# LinkedIn current role (Experience)

The current role sits right under the About. Owners skim it to see what this person does now and for whom. It should read like a short offer, framed as client outcomes, not a job description.

## Criteria

### title | weight 2 | Title says what they do for whom
5: The title is searchable and clear (for example "Business Profit Coach for building services firms", or for a discreet coach an operator or adviser title that is true), not just a company name or "Founder".
3: A plain title that is accurate but generic ("Business Coach", "Director").
1: Missing, vague or jokey ("Chief Happiness Officer").

### outcomes | weight 3 | Framed as client outcomes
5: Says what owners get from working with them (results, changes in the business and their week), not a list of duties.
3: A mix of outcomes and duties.
1: Duties only, or empty.

### who_for | weight 2 | Who they work with
5: Names the owner group and size or situation they work with.
3: "Business owners" or "SMEs" only.
1: No audience.

### proof | weight 2 | One real proof point
5: At least one specific result (from, to, timeframe) or a concrete credibility marker true for this coach.
3: Vague proof.
1: None.

### next_step | weight 1 | Points to a next step
5: Ends with how to start (BOSS Scorecard, a short call, a message).
3: Implied.
1: None.

## Checked in code

- `length`: gate over 2,000 characters (LinkedIn's limit); penalty under 200 characters for the description.
- `em_dash`: penalty.
- `buzzwords`: penalty.
- `discreet_coach_word`: gate when the coach is discreet and the role says "coach" or "coaching" (Ava only).
- `invented_numbers`: gate when a number is not in the coach's facts (Ava only).

## Examples

### Strong
Business Profit Coach for building services firms

I work with MDs of HVAC and M&E contractors (10 to 50 staff) who are winning work but not seeing the profit. Together we get margin visible job by job before month-end, get retentions moving, and build a management layer so the MD stops being the last line of everything.

As Operations Director at Harlow & Pike I took the HVAC division from £4.2m to £11.8m in five years.

Start with the 3-minute BOSS Scorecard, or message me for a 20-minute look at your numbers.

### Weak
Founder

Providing consultancy services to clients across various sectors. Responsible for strategy, operations and business development.
