---
id: linkedin.headline
title: LinkedIn headline
pass: 70
---

# LinkedIn headline

The headline is the line an owner sees next to every comment, invite and message. It should tell the right owner, in a second, that this person helps people like them get a result they want. In our data the exact wording did not move acceptance much, so the bar is clarity and fit, not cleverness.

## Criteria

### audience | weight 3 | Names who they help
5: Names a specific owner group the way that owner would describe themselves (a sector, a size, or a situation), for example "HVAC and M&E contractors" or "owners of 10 to 50 person accountancy firms".
3: Names owners in general ("SME owners", "business owners", "leaders").
1: No audience at all, or only a job label ("Business Coach", "Consultant").

### outcome | weight 3 | Says the result they get
5: A concrete outcome the owner wants, in owner words (more profit per job, a business that runs without them, cash in the bank).
3: A generic outcome ("growth", "scale", "success", "unlock potential").
1: No outcome, or only a list of services or titles.

### credibility | weight 2 | Gives a reason to believe
5: One specific credibility marker that is true for this coach (a former role at a named company, a real result with a number, a method name they use).
3: A soft marker ("20+ years experience", "award-winning") with nothing specific.
1: None, or a claim that reads as hype.

### owner_language | weight 2 | Sounds like the owner, not a coach
5: Plain words an owner would use. Industry nouns where they fit. No coaching or consulting jargon.
3: Mostly plain, with one or two stock phrases ("passionate about", "driving growth", "empowering").
1: Coach-speak or buzzword chain ("Transformational Leadership Coach | Mindset | Growth | Impact").

### scannable | weight 1 | Easy to read at a glance
5: One clear idea, front-loaded, readable in the feed preview (first 60 to 80 characters carry the point).
3: Readable but the point sits at the end, or two ideas compete.
1: A wall of pipes, emojis or keywords.

## Checked in code

- `length`: gate over 220 characters (LinkedIn's limit).
- `em_dash`: penalty.
- `buzzwords`: penalty for "passionate", "results-driven", "driving growth", "transform", "empower", "unlock", "guru", "ninja".
- `discreet_coach_word`: gate when the coach is discreet and the headline says "coach" or "coaching" (Ava only).
- `invented_numbers`: gate when a number is not in the coach's facts (Ava only).

## Examples

### Strong
Helping HVAC and M&E contractors fix margin bleed and get the MD out of the middle | Former Operations Director, Harlow & Pike

### Weak
Business Coach | Mentor | Passionate about helping leaders unlock their potential and drive growth 🚀
