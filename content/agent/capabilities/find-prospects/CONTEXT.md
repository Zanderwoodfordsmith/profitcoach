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
2. Ask how they would like to find people. Many coaches will not know. Recommend one, then give the strengths and limits of the options that fit, in short bullets. Offer only the options that fit:

| Source | Best for | Needs | Open |
|---|---|---|---|
| Sales Navigator search | Owners by industry, title and size, anywhere on LinkedIn. The default for connector campaigns. | Their LinkedIn connected, with Sales Navigator | `sales-navigator-import` |
| Google Maps | Local trades and services (plumbers, dentists, accountants) in a town, county or US state | Nothing. Costs a little per business found | `google-maps-import` |
| Google Search | The same local businesses when they rank on Google, not only on a map | Nothing. Costs a little per business found | `google-search-import` |
| A list they already have | People already imported into the pool or a list | | `lists` |
| Their own connections (1st degree) | Warm outreach to people they already know | LinkedIn with Sales Navigator | `sales-navigator-import` with degree 1 |

3. Recommend from what they want to do next, using the trade-offs below. Sales Navigator for most coaches who want to message owners on LinkedIn. Google Maps when the market is a physical, local business and they want a phone or email. Their existing list when the people are already in the pool. Google Search only when the businesses show up on Google and not on a map, and say we have not proven that path yet.
4. Once they choose, open that capability and follow its contract. For Sales Navigator, the next step suggests the narrowing from their blueprint (company-name words and variations first) and checks how many people match before anything is imported.

## When they are not sure

Say which you would pick and why, in one sentence, then the trade-off for each option you offer. Keep it to a few bullets. Do not present them as equal.

- **Sales Navigator.** Strength: you get LinkedIn profiles of owners, by title, company type and size, and you can message them there. This is the right source for a connector campaign. Limit: emails and phone numbers are thin. It is not a calling list or an email list.
- **Google Maps.** Strength: businesses with a physical place (plumbers, dentists, accountants, and similar). You usually get the business phone, and often a website and an email. Limit: you will not always find the owner. Many rows are the business, with a guessed contact, not a person you can message on LinkedIn.
- **Google Search.** Same idea as Maps, but from websites that rank on Google rather than map pins. We look up one person, an email and a phone the same way. We have not tested this much in real coaching, so do not sell it as proven. Offer it when they want businesses that show up in Google and not only on a map, and say we are still learning how reliable the owner and the contact details are.
- **A list they already have.** Strength: people they have already chosen. Nothing new to search, and they can go straight onto a campaign. Limit: it does not find a new market. A connector campaign needs a LinkedIn profile on the row. An email step needs an email. If the list is only names and companies, say what is actually usable and offer an import for the rest.
- **Their own connections (1st degree).** Strength: warm. They already know these people, and LinkedIn messaging works. Limit: the list is finite. It is not how you build a new market, and emails and phone numbers are as thin as any other Sales Navigator list.

## List size and quality (from the classroom)
Aim for at least 600 people (two A/B variants of 300). 1,200 is great, 1,800 is better. Quality beats size: if a spot check of 10 people finds 8 good matches, the list is fine. Details in `list-kpis.md`.

## What NOT to do
- Do not start an import from here. The source capability holds the confirmation.
- Do not ask for everything at once. Source first, then that source's questions.
- Do not invent targeting. If there is no blueprint and they are unsure who to target, ask what kind of business owner they help best.
- Do not hide the trade-off when they ask which way is best, or when they sound unsure. Do not claim Google Search is as proven as Maps or Sales Navigator.
