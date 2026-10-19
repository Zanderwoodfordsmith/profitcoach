---
id: research.pains
title: Pain research (owners' own words)
pass: 70
---

# Pain research

Ava searches public forums (Reddit today) for what owners in a market say about their problems, then pulls out short quotes in their own words. These quotes feed the avatar, the pain points and every message. A quote is only useful if it is real (it came from a post), it is about running this kind of business, and it sounds like a person talking.

The case gives the snippets Ava was shown and the target market. Judge the quote list as a whole.

## Criteria

### relevant | weight 3 | About this market's owners
5: Every quote is from or about owners running this kind of business, about a business problem (profit, cash, staff, time, customers, growth).
3: Most are relevant, one or two are off-market or personal.
1: Mostly off-topic (politics, employees moaning about a boss, consumer complaints, jokes).

### owner_voice | weight 2 | Sounds like an owner talking
5: First person, plain, quotable, keeps trade words ("We're winning tenders but...", "I can't get a plumber to stay past six months").
3: Paraphrased into neutral summaries.
1: Reads like a consultant's summary, not a person.

### distinct | weight 2 | Covers different pains
5: Quotes cover several distinct pains (cash, staff, time, pricing, growth) without repeating the same point.
3: Some repeats; two or three pains only.
1: All the same point.

### usable | weight 2 | Useful in a message
5: Most quotes could open a connection message or a post as "owners tell me...", short and vivid.
3: Some are too long or too vague to use.
1: None would work in a message.

### honest_yield | weight 1 | Fewer, better
5: When the snippets are thin, returns a few strong quotes rather than padding. Drops spam and noise.
3: Some padding.
1: Padded with weak or invented quotes.

## Checked in code

- `grounded`: gate when a quote is not found in any snippet it was given (word overlap under 60%, allowing light trimming). Each quote's link must match the snippet it came from.
- `noise`: penalty for each quote taken from a snippet marked as noise in the case (spam, politics, off-market).
- `count`: penalty for more than 10 quotes, or zero quotes when good snippets exist.
- `em_dash`: penalty.
