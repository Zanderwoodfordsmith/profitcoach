# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| profit-coach-home | Self-diagnosis (visitor operates the page; every act asks or reflects) | Static masthead inside the hero stage, then a docked bottom readout (live mini wheel, flag count, one CTA) | Pinned layered constellation: problem chips on depth planes tethered to a "You" node, converging on scroll, pointer parallax | pin 2.2 > flow+in > PIN 3.4 (peak, 3rd) > pan 2.8 > flow+reveal > in > count > flow+parallax > in > pin 1.25 (10 acts, 17.5vh) | Pinned navy hold: the visitor's own wheel returns with "You flagged N of 10", one CTA, footer inside the stage | Recognition ledger whose ticks light a live BOSS Wheel, then the peak sweep reads all ten areas | Light instrument + navy console, hard cuts, Figtree + IBM Plex Mono | 4500 |
| profit-coach-home-v2 | Self-diagnosis, variant of v1 | Floating glass bar (logo, links, small CTA; icon menu on mobile), then the same docked readout | Pinned constellation, now split: copy left and centred, colour-coded chips right | pin 1.6 > flow+reveal (old way / new way split) > flow+in > PIN 3.2 (peak, 4th) > flow+reveal (level staircase) > flow+parallax (photos) > in > count > flow+parallax > in > pin 1.25 (11 acts, 16.5vh) | Same held close, with the report-style colour wheel | Old way / new way split (Caveat scribble page against the real BOSS Wheel), then a peak wheel whose petals wobble with scroll before settling into two numbered focus areas | Light + navy, app area and level colours, Figtree + IBM Plex Mono + Caveat (old way only) | 4501 |

*(empty: your first build has nothing to clear, so build whatever the interview
points at. From the second onwards, this table is the constraint.)*

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

Nothing is taken yet.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
