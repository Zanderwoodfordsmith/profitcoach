# Product

<!-- impeccable:product-schema 1 -->

<!-- This file is the durable product and brand context for design work.
     Impeccable reads it before every design command. Edit freely: it is
     yours, plain markdown, no tooling required. Keep facts true; mark
     anything undecided as undecided rather than guessing. -->

## Platform

web

## Users

UK business owners running owner-led companies doing £1M+ revenue. Public copy prints "£1M+" with no ceiling. Internally, the ideal client sits between £2M and £20M, with £1M to £10M the core of the market (Zander, Aug 2026). Industries: trades, engineering, manufacturing, construction, and services. Owner-led is the common thread, not sector. Age 35 to 60, teams roughly 5 to 50. Still deep in the day-to-day: they do most of the sales, every decision routes through them, and the week is reactive. Analytical, short on time, reading on desktop and phone.

Secondary audience: BCA-trained coaches who deliver the system. They are the channel, not the homepage target.

Background detail in `content/ai-knowledge/icp.md` and `avatar-profile.md` (both aligned to this band in Aug 2026).

## Product Purpose

The Profit Coach is a diagnostic-led business coaching brand. The BOSS Diagnostic scores a business out of 100 across 10 areas (9 business areas plus Owner Performance as the foundation), places the owner on 5 levels (Overwhelm to Owner), and produces a 90-day plan. Certified Profit Coaches deliver the fixes with the owner.

Success for the marketing site: owners take the free BOSS Score, book a call, and enter coaching. The homepage is the brand's central funnel.

## Positioning

Most business coaching sells a person and their opinions. There is usually no framework behind it and no measurement at all. The Profit Coach sells coaching built on an instrument: the BOSS Diagnostic scores the whole business including the owner (Area 0, Owner Performance), and the coach works from that score. Data before advice.

Market position: the premium tier of the category. Aston Martin over Ford. Nike over Adidas. The Apple of business coaching.

Candidate one-liner (Zander, Aug 2026, undecided): "The Scalable for founders doing £2M–£20M" (or £1M–£10M). Direction approved, exact framing and band not settled.

## Operating Context

- Funnel: homepage → `/score` opt-in → BOSS Diagnostic → results page (the sales page) → £495 strategy call → 6-month programme.
- Marketing pages are self-contained Next.js routes under `src/app/`, Tailwind v4, each page owns its shell. No shared marketing component library yet.
- The product dashboard uses the brand gradient sidebar: `linear-gradient(165deg, #051e36 0%, #0c5290 48%, #1a8fd4 100%)`. Marketing surfaces carry the same gradient as the brand signature.
- Brand knowledge lives in `content/ai-knowledge/`. The writing rules there are binding for all copy.

## Capabilities and Constraints

- Reusable live components: `BossWheel` (app), the `profitSystem` graphics (NineStepRoadmap, OwnerLevelsDiagram, hexagons, pyramid), and the custom marketing wheel in `src/app/home-v3/`.
- Diagnostic facts cleared for copy: 50 questions, 10 areas, 5 levels, scored out of 100, free, about 10 minutes. Funnel multiplier maths: five inputs improved 10% each is 1.1^5 = 1.61, a 61% revenue increase.
- Undecided, do not publish: coaching and programme prices on marketing pages; benchmark medians (dataset not built yet).
- Retired claims: "Unlock 30-130% more profit". Never use countdown timers, fake scarcity, invented testimonials, or invented case studies.

## Brand Commitments

- Names: The Profit Coach (brand). BOSS Diagnostic (instrument), BOSS Score (output), BOSS Wheel (visual). The Profit System (framework: 3 pillars, 9 steps, 50 playbooks). The 5 Levels (Overwhelm, Overworked, Organised, Overseer, Owner).
- Voice: operational, not therapeutic. Data before emotion. Short human sentences. Never an em dash. Binding rules: `content/ai-knowledge/writing-rules.md`.
- Visual direction (set by Zander, binding): Apple-grade premium, modern and futuristic. Clean whites, generous spacing, the navy-to-sky brand gradient as the signature element. Elite positioning over mass-market. An earlier dark-plus-gold direction is retired.
- Logos: `public/profit-coach-logo.svg` (colour, transparent), `public/brand/profit-coach-logo-white.svg` (white). The "colour-no-bg" PNG has a baked black background; avoid it.
- Tagline: Less chaos. More profit. Real freedom.

## Evidence on Hand

- Real testimonial: John Davy quote (in use on `/pam` and `/home-v3`). No other named testimonials yet.
- Stats cleared for use: 45+ years coaching experience (Pam Woodford), 250+ coaches trained worldwide, 25+ business methods mapped into the system, 50 playbooks across 10 areas.
- Photography: `public/pam/pam-portrait.jpg` (wordmark baked into the bottom fifth, crop it out) and `public/pam/pam-bca.png` (stage shot). The `/home-v3` hero photo is an Unsplash placeholder awaiting brand shoots.
- Not yet real, do not fabricate: benchmark medians, the Predictable Profit Blueprint (opt-in coming), client video stories.
- Founding story (cleared for a future About page, Zander Aug 2026): the Pam and Zander story, including a near-death chapter, plus the arc of sharing the system with other coaches who then made their own transformations. Get the details from Zander before writing it; do not invent specifics.

## Product Principles

1. The diagnostic is the hero. Every surface funnels to the free BOSS Score.
2. Show the maths, not hype. Claims must be calculable or evidenced.
3. Owner-first. Owner Performance and the 5 Levels are the self-identification devices; owners must see themselves on the page.
4. Coaches close, data opens. Data plus a human, never data versus humans.
5. Premium restraint. Fewer, better elements; whitespace and the gradient carry the brand.
