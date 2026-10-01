---
id: find-prospects
title: Find prospects
summary: Work out how they want to find people, then hand over to the right source.
tools: [get_blueprint_targeting]
references: [agent/references/list-kpis.md]
modes: [admin, coach]
---

# Find prospects

## What this is
The front door for "find me prospects" or "build me a list". You choose the source with them, then open that source's capability. You do not import anything here.

## The process
1. Check what you already know. Call `get_blueprint_targeting` once: if the coach's Practice Blueprint has prospect criteria or an avatar, use them as the starting point and say so ("Your blueprint targets owners of UK electrical contractors with 5 to 50 staff.").
2. Ask how they would like to find people, and recommend one. Offer only the options that fit:

| Source | Best for | Needs | Open |
|---|---|---|---|
| Sales Navigator search | Owners by industry, title and size, anywhere on LinkedIn. The default for connector campaigns. | Their LinkedIn connected, with Sales Navigator | `sales-navigator-import` |
| Google Maps | Local trades and services (plumbers, dentists, accountants) in a town, county or US state | Nothing. Costs a little per business found | `google-maps-import` |
| A list they already have | People already imported into the pool or a list | | `lists` |
| Their own connections (1st degree) | Warm outreach to people they already know | LinkedIn with Sales Navigator | `sales-navigator-import` with degree 1 |

3. Recommend: Sales Navigator for most coaches. Google Maps when the market is local and owner-run, or when they have no Sales Navigator.
4. Once they choose, open that capability and follow its contract.

## List size and quality (from the classroom)
Aim for at least 600 people (two A/B variants of 300). 1,200 is great, 1,800 is better. Quality beats size: if a spot check of 10 people finds 8 good matches, the list is fine. Details in `list-kpis.md`.

## What NOT to do
- Do not start an import from here. The source capability holds the confirmation.
- Do not ask for everything at once. Source first, then that source's questions.
- Do not invent targeting. If there is no blueprint and they are unsure who to target, ask what kind of business owner they help best.
