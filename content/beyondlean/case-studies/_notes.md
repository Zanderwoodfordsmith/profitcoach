# Beyondlean case studies: notes

Internal only. Never publish this file. The site loader should skip any file whose name starts with `_`, and should never show the `confirm` field.

Written 29 Oct 2026, overnight build. 14 case studies, one file each, in this folder.

## How these were written

- **Shape** follows the BCA site case studies (`bca-website/lib/case-studies.ts`): an outcome headline, a two-sentence card summary, a few numbers up top, the story (problem, what we did, what changed) and advice for an owner.
- **Clients** are all anonymised. No client staff are named. Paul's employer names appear only in this notes file, where he needs them to check his facts.
- **Status:** "Delivered" only where results were measured after the work. "Found in the review" where the numbers are savings found in a diagnostic. Every study built from Paul's CV, LinkedIn or Blueprint (rather than a deck or PDF) says "Needs Paul's confirmation" at the start of its `confirm` field.
- **Voice:** "we" for Beyondlean, "Paul" where his own role matters. The story is in the past tense; the owner advice is in the present tense.
- **Checks run:** a script confirmed every file has the exact frontmatter keys (all double-quoted strings), the five H2 sections in order, 3 to 5 "At a glance" bullets each starting with a bold number or fact, 150 to 400 words, no em or en dashes, and none of the client or staff names.

## Decisions I made (overturn any of these)

1. **14 studies, not 10.** Besides the ten in the brief, I wrote four more from the CV and Blueprint where there was enough real detail: media telesales, bank errors, bank collections, and the airline caterer's wider rebuild. Drop any you don't want.
2. **Order** (1 = strongest for owners): airline caterer meals, snack maker, car business, housing association, bank errors, energy contact centre, media telesales, mortgage team, airline caterer rebuild, energy trader, aerospace, bank collections, government agency, insurer post room. Deck-backed and owner-relevant first; the big corporate and public-sector ones lower; the insurer last (small, old, not delivered).
3. **CV-based studies are marked Delivered**, because Paul's CV or LinkedIn reports them as results, not opportunities. All carry the confirmation flag. Identified-only numbers (£30m bank diagnostic, £210m mail operator) were left out.
4. **Where sources disagree, I used:** Club Meals 4 months (old CV, written nearer the time; Blueprint says 6); aerospace £1.4m (CV; Blueprint says £1.5m); the old CV's numbers for media telesales and the government agency (LinkedIn's differ); 420 to 314 people for collections (Blueprint; CV says 105 roles).
5. **Snack maker uses the corrected net total**, about £1.4m (see number checks).
6. **Sectors:** snack maker is "Manufacturing" (could be "Food production"); energy contact centre is "Energy" (could be "Contact centres"); housing association is "Contact centres" (no housing option).
7. **Housing association figure** is "12 of 16" areas at competitive level by August, up from 2 in March. I read this from the bar charts in the PDF. Timeframe "5 months" comes from the March and August assessment dates.
8. **Photos:** each stock photo is used once, on the four deck-backed studies where it fits (food trays: airline caterer; assembly line: snack maker; whiteboard: housing association; whiteboard-present: energy trader). The other ten have `photo: ""`. All are placeholders until Paul sends real ones.
9. **"Up 500%"** kept as Paul wrote it, rather than "fivefold" (see the car business questions).
10. **Plain words:** "the review" instead of "diagnostic", "wasted effort" instead of "non-value-added", "people" instead of FTE.
11. **Airline caterer rebuild keeps the dispute**, because it is the point of the story. Flagged, because it makes the client easier to recognise.

## Study by study: sources and what Paul must confirm

### 1. airline-caterer-business-class-meals.md (Delivered)
- **Sources:** `beyondlean/source/from-paul/Story Board Club Meals.ppt`; `beyondlean/source/live-site-2026/club_meals.pdf` (same slides); old CV ("Club Meals project, duration 4 months"); Blueprint career results "Airline Catering: £1,026,000 to £720,000 staff costs, 6 months" (that is 57 vs 40 people at £18,000) and "Food production: floor space 156 to 120 m², 3 months" (same project).
- **Confirm:** 4 months or 6? Can the client be named? The deck carries a confidentiality notice, so the default is no.

### 2. uk-snack-maker-packing-lines.md (Found in the review)
- **Sources:** `Snack_Manufacturer_case_study.pptx`; `snack_manufacturer_case_study.pdf`. Machine data from 4 to 5 and 10 to 11 Dec 2018; plan January to September 2019.
- **Confirm:** What was delivered, and what results followed? Is 5p profit per bag right (the deck marks it "TBC")? Is the business owner-led? If yes, say so; it is the closest match to Paul's target market. Can it be named? Would the owner give a quote?

### 3. car-business-profit.md (Delivered, needs confirmation)
- **Sources:** old CV page (`beyondlean/source/site-export-2022/beyondlean.com/paul-swift-lean-six-sigma-management-consultant.html`): "Aidan Piers, Service Manager then Production Director, Aug 1994 to Jan 1999: increasing profits by 500% through improvement activities and culture change; cash flow up £350K from lower stock; JIT, inventory down 95%; stock budget around £800k". LinkedIn and Blueprint: "Sports and Performance Cars, Production Director, 1994 to 1998". Paul's own business before that: Merit Car Sales & Service, 1989 to 1994 (CV) or Merit Cars, 1990 to 1994 (Blueprint).
- **Confirm:** Which name, title and dates are right? What did the business do, how many people did it have, and was it owner-run? Over what period did profits rise? "Up 500%" read literally means six times the profit; does Paul mean five times or six?

### 4. housing-association-contact-centre.md (Delivered)
- **Sources:** `contact_centre_case_study.pdf`, which Paul's live Diagnostic page labels "Housing Association Contact Centre". Paul's Blueprint lists a housing association role in 2019; this may be it. The PDF masks its dates ("20XX").
- **Numbers used:** 136 advisers, 63 over the call-time target (histogram, page 9); 21% staff turnover; email briefings about 7% effective.
- **My chart reading (page 11, rendered at 3x):** in March, 14 of 16 areas sat in Basic (capacity planning and workplace environment were just into Competitive). In August, 12 of 16 reached Competitive; capacity planning, managing the business, team leader training and process management stayed Basic. Several August bars sit right on the Basic and Competitive line.
- **Confirm:** Are those counts right? Any hard numbers after the work (problems fixed first time, staff turnover, call time)? Which year? Can we say "housing association"?

### 5. bank-team-errors.md (Delivered, needs confirmation)
- **Source:** Blueprint career result "Banking: 56 to 11 errors per team per month, 3 months; SOPs, visual management / QCD metrics and leadership coaching". No CV entry or deck.
- **Confirm:** Which bank and team, and when? How were errors counted? Is "UK bank" right?

### 6. energy-contact-centre-costs.md (Delivered, needs confirmation)
- **Sources:** Blueprint career result "Utilities customer service centre: 800 people, team of 6, annualised benefits £3m, £10.5m to £7.5m operating costs, 12 months". LinkedIn (via `beyondlean/research/02-proof-and-story.md`): about 200 seconds off average call time across 800 people, signed-off benefits over £3m, role 2016 to 2018. "More than 12 call centres" comes from the old site page `lean-case-study.html`.
- **Confirm:** All the numbers, that the £3m was signed off by the client, the dates, and whether "major UK energy supplier" is OK.

### 7. media-company-telesales.md (Delivered, needs confirmation)
- **Source:** old CV, "Feb 07 to Aug 08: Major Media Provider": Model Office pilot and roll-out across 3 telesales sites, 2 installation support sites and a service support site; install support efficiency up 35%; order entry quality up 65%+; sales conversion up 25% in pilot teams; accredited Lean training for 72 managers and coaches; SOPs in telesales; client-declared savings over £3,000,000.
- **Conflict:** LinkedIn (research 02) gives, for what looks like the same client, quality up 50% and staff savings worth £1.2m; telesales quality up 40% and conversion up 15%.
- **Confirm:** Which numbers are right? Is the missing "Dudley Telesales case study" this project?

### 8. bank-mortgage-offers.md (Delivered, needs confirmation)
- **Source:** old CV, "Aug 08 to Nov 08: Major UK Bank, Mortgage Operations": led and coached the bank's improvement consultants through a pilot and a roll-out proposal; productivity up 160%; lead time to offer down 50%; customer service staff down 50%.
- **Confirm:** Were these measured in the pilot? Did the roll-out go ahead? What did "staff down 50%" mean in people?

### 9. airline-caterer-new-staff.md (Delivered, needs confirmation)
- **Source:** old CV, July 2005 to November 2006 role: contingency planning during an industrial dispute; return to full service with 90% new staff within one month; layout redesign cut movement by over 30%; a performance management system raised productivity 30%; headcount 411 to 267 with output kept (£2,592,000). That saving equals 144 people at £18,000, so I read it as a yearly figure.
- **Confirm:** The numbers. Is Paul happy to mention the dispute? Is the Club Meals saving inside the £2.59m?

### 10. energy-trader-reporting.md (Found in the review)
- **Source:** `WMO Reporting Initial Opportunities.pptx` (client template, © 2020).
- **Confirm:** Which changes went ahead, and what did they deliver? LinkedIn lists "an extra 60 minutes of trading time per day"; is that from this work? Never show the deck: it names a client staff member and carries the client's copyright.

### 11. aerospace-wing-panels.md (Delivered, needs confirmation)
- **Sources:** old CV (in-house Lean consultant, Feb 1999 to Sept 2004): "£1,400,000 saving per year in Machining area"; "Standard Work Combination Tables produced for wing panel production resulting in a benefit of approx £1,400,000 per year"; quality up 65%; 100% delivery schedule adherence; £240k saved per wing-set; 60+ operators trained in quick changeover and machine care. Blueprint: "Aerospace Manufacturing: £1.5m a year, 11.5 to 7.5 day cycle time, 6 months".
- **Confirm:** £1.4m or £1.5m? Are the 11.5 to 7.5 days for wing panels? Which area and years do the 65% quality and 100% delivery belong to?

### 12. bank-collections-three-sites.md (Delivered, needs confirmation)
- **Sources:** old CV, "Feb 10 to March 11: Collections & Recoveries Site Migration": three sites into one; a telephony centre of excellence; coached internal consultants; 105 roles released; quality up 46%. Blueprint: "420 to 314 people, 12 months, 3 sites into 1, extensive leadership coaching".
- **Confirm:** 105 or 106 roles? The dates?

### 13. government-agency-pilot.md (Delivered, needs confirmation)
- **Source:** old CV, "Apr 09 to Sep 09: Government Agency": led the New Ways of Working pilot and roll-out; coached internal consultants to an accredited level (Cardiff Business School); productivity up 50%+; quality up 42%; query referrals down 70%. Paul's Blueprint lists a public-sector agency role from 2009 to 2010, and LinkedIn (research 02) says "productivity and quality up more than 40%".
- **Confirm:** Is it the same agency? Which numbers are right? What did "query referrals" mean?

### 14. insurer-post-room.md (Found in the review)
- **Source:** `Post Processes Overview.ppt` (created March 2004, updated 24 Aug 2004). Its file properties name a different consultancy as the company, not Beyondlean. This client is not on Paul's LinkedIn or in his Blueprint.
- **Number check:** the deck's parts (7.02 + 26.6 + 7.5 + 18.36 + 33.27 + 6.3 hours a week) add to 99.05, not the 74.45 total it states, so they must overlap. I used only the total.
- **Possible link:** the old CV lists a "4 week scoping project within Major Insurance's internal mail processes: 4 FTE savings". The deck also says policy teams spend about 90 hours a week sorting post, with savings "captured within workstreams". 74.45 + 90 is about 164 hours, about 4.4 people, which may explain the CV's 4.
- **Confirm:** Whose engagement was it? Was any of it delivered? Is it the CV's 4-person mail review?

## Number checks

- **Snack maker:** the deck's £1,484,668 adds the savouries figure before taking off its £60,000 staff cost. The correct net is £766,720 + £657,948 = £1,424,668. Used "about £1.4m".
- **Energy trader:** £121,448 + £484,795 + £403,768 + £12,011 = £1,022,022. Matches the deck.
- **Club Meals:** 17 × £18,000 = £306,000; 156 to 120 m² is 23% less. Both match.
- **Airline rebuild:** 411 minus 267 = 144; 144 × £18,000 = £2,592,000.
- **Collections:** 420 minus 314 = 106 (CV says 105).
- **Bank errors:** 56 to 11 is 80% fewer.
- **Energy contact centre:** £10.5m minus £7.5m = £3m.

## Not written (too thin, or identified only)

- Defence back-office services, 2012 to 2016: productivity up 30% to 100% in three service areas, lead times down over 30%, 20+ internal consultants trained (LinkedIn); vetting productivity up over 40% (old CV). Ranges only, and little on what was done. It could become a study if Paul gives one area's before and after.
- Bank diagnostic, 2008 to 2009: about £30m identified, nothing shown as delivered.
- Mail operator scoping, team of five: £210m identified nationwide.
- Pensions role, 2021 to 2023: £75m is a team figure.
- Aerospace components, 2004 to 2005: delivery adherence up 35%, productivity up 20%, no story.
- Banking cards (28 roles released) and a commercial contact centre (11 roles): one number each.
- Coaching roles, 2023 to 2025: no numbers.
- Paul's Blueprint line "hundreds of millions" is not used anywhere. See research 02 for safer wording.

## Problems on Paul's live site (found while reading, not fixed)

These PDFs are public on his Diagnostic page today:
- `club_meals.pdf`, page 2: chart labels show five staff members' names.
- `contact_centre_case_study.pdf`, page 7: the team leader seating plan shows advisers' first names.
- `snack_manufacturer_case_study.pdf`, page 19: the plan title names the client and its owner.

Paul should take them down or replace them, whatever happens with the new site.

## What would make these stronger

1. Permission to name any client, or to say "family-owned" for the snack maker.
2. One short quote from a past client per study, above all the snack maker's owner.
3. Real photos to replace the four placeholders.
4. The five attachments that never arrived: the DMAIC project example, the commodities trading case study, the Dudley telesales case study, the contact centre forum pack and the demand process future-state pack. The telesales one may upgrade study 7, and the commodities one may add a delivered result to study 10.
