---
version: 1
slug: "src-app-site-slug"
primary_target: "src/app/site/[slug]"
related_targets: []
---

Scope: coach websites at /site/[slug] (plus /site/[slug]/heroes, preview only). Mode: Persuade.

Audience: owner-MDs of £1M+ owner-led businesses, arriving from the coach's LinkedIn and outreach. Job: believe this coach knows their patch and their problem, and works from an instrument. Actions: Get your BOSS Score (/score/{slug}), Book a call (/book/{slug}), or take the BOSS Scorecard home (opt-in via /api/leads/capture).

Content: every word comes from the coach's Blueprint (offer:direction, offer:lines, story:onepager, story:bio, proof.client_results) through src/lib/coachSite/fromBlueprint.ts. No prices. Example BOSS Wheel is labelled Example. Graphics are the print pack (src/lib/printPack) drawn inline.

Direction: inside the Profit Coach / BCA world (Figtree two-weight headlines, navy band gradient, hairline ledgers). Memorable moment: the Territory hero, a dot-matrix British Isles lit outward from the coach's town. Other moments: the gap ledger that brightens row by row on scroll, the pinned five-lever multiplier ending on x1.61, the wipe from Today to With {coach}.

Variants (URL params): hero territory|dossier|gap|wheel, system wheel|oldnew, proof ledger|band, close score|call. Seed 0c21a628 dealt Territory, Dossier, The gap; Wheel added from the brand rule.

Unresolved: which variants become the default; production release (COACH_SITES_LIVE, approvedOnly); coach website photo upload; custom domains; privacy notice link for the opt-in.
