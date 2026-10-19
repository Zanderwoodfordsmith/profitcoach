---
id: campaign.nurture
title: Ongoing nurture
pass: 70
---

# Ongoing nurture

For connections who are not ready yet. A message every two weeks or so that gives away one useful BCA tool, so the coach stays front of mind until the timing is right. A booked call usually takes many messages over one to four months, so this is where most calls come from. Each message opens with a personal first line, gives one tool with three emoji-numbered benefits, and ends with a link placeholder. These messages have room to sound like the coach.

The whole sequence is scored as one piece. Quote the message number in your evidence.

## Criteria

### one_tool | weight 3 | One useful tool each
5: Each message gives away one named, relevant tool (Profit Maximiser, Cashflow Forecaster, Time Value Tracker, Pairwise Prioritisation, Revenue Growth Accelerator, the BOSS Scorecard) matched to a pain this owner has.
3: Tools are named but not tied to the owner's pain, or two messages give the same thing.
1: No tool, or "just checking in".

### personal_open | weight 2 | Personal first line
5: Each message opens with a line written for this person (a square-bracket prompt for the coach to personalise from their posts or business).
3: A generic opener ("Hope you're well").
1: Straight into a pitch.

### benefits | weight 2 | Clear benefits
5: Three short, concrete benefits per tool (emoji-numbered), in owner words.
3: Benefits vague or not in the shape.
1: No benefits.

### voice | weight 2 | Sounds like this coach
5: Sounds like the kind of coach they are. Uses a story, book, film or hobby they named in at least one message, and never invents one.
3: Professional but could be any coach.
1: Generic or salesy, or invents a personal story.

### low_pressure | weight 2 | Keeps giving, no pressure
5: No pitch, no call ask beyond a light "want me to send it?". Reads like help.
3: One heavier ask.
1: Pushy, guilt or fake urgency.

### rhythm | weight 1 | Sensible rhythm
5: Spaced about two weeks apart, with a plan for people who said "not now" and a 90-day check-in.
3: Rhythm unclear.
1: Too frequent or no rhythm.

## Checked in code

- `count`: penalty when there are fewer than three messages.
- `link_placeholder`: penalty when a message has no link placeholder for the tool.
- `banned_phrases`: penalty for "just checking", fake scarcity, "other coaches".
- `tokens`: gate on tokens nothing fills.
- `em_dash`: penalty.
- `invented_numbers`: gate when a number is not in the coach's facts (Ava only).

## Examples

### Strong
Message 1: [Personal first line from one of their posts]

Most contractors I speak to are busy, but at a 10% margin every £1 of cost you cut is worth £10 of sales. I put together a simple tool that shows you exactly that for your business.

The Profit Maximiser:
1️⃣ Shows what a 5% cut in costs does to your profit
2️⃣ Finds the three costs worth looking at first
3️⃣ Takes 10 minutes with last year's numbers

[link to the tool]

### Weak
Message 1: Hi {first_name}, just checking in to see if now is a better time to chat about coaching? I have a couple of slots left this month.
