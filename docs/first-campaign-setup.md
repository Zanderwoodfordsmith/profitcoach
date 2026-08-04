# First Campaign Setup — build brief

Guided onboarding that takes a new coach from "I've joined" to "I know exactly who I'm targeting and what to send them" in about an hour.

## 1. Activation definition

A coach is activated when they have all five of these saved to their account:

1. LinkedIn profile imported
2. One ICP chosen
3. Ideal client avatar reviewed; confirmed slices saved to brain
4. 3–4 outreach messages drafted and approved
5. A starter list of 100–250 named prospects

Anything that does not move a coach toward those five is out of scope for this flow.

## 2. UX shape

Left rail = five steps with state (locked / active / complete). Main content = the actual tool for that step, with a short AI panel that proposes and explains rather than free-chats.

```
┌──────────────────┬────────────────────────────────────┐
│ 1 LinkedIn    ✓  │                                    │
│ 2 Choose ICP  ←  │   Tool for the active step         │
│ 3 Avatar         │   + AI panel: proposes, coach       │
│ 4 Messages       │     confirms or edits               │
│ 5 Starter list   │                                    │
└──────────────────┴────────────────────────────────────┘
```

Rules that keep it fast:

- Every step offers **two or three options, never ten**. The coach picks and tweaks.
- Every step ends with a saved artifact, so the wizard can be resumed.
- Steps are re-runnable later from Get Clients; this is not a one-time-only flow.

## 3. The five steps

### Step 1 — Import LinkedIn

| | |
|---|---|
| Coach does | Pastes profile URL (prefilled from `profiles.linkedin_url` if set) |
| System does | Existing Apify profile scrape; stores snapshot |
| Exists | `src/lib/apify/linkedinProfile.ts`, `POST /api/coach/linkedin/profile`, `coach_linkedin_profiles` |
| New | Wizard-framed UI; extract roles / sectors / seniority / keywords from the snapshot for step 2 |

### Step 2 — Choose ICP

| | |
|---|---|
| Coach does | Picks one of 2–3 proposed segments |
| System does | Proposes segments from their career history and our avatar library, then shows how many matching leads we hold |
| Exists | Lead Finder filter model and corpus (`src/lib/leadFinder/`) |
| New | Coach-facing access to Lead Finder; an inventory-count endpoint; a `coach_icps` record |

**Fit beats inventory.** The lead count is shown as information, not as a gate. If a coach's real expertise is in an obscure vertical we hold few leads for, that ICP still wins — we source the list another way rather than pushing them into a segment we happen to stock. Forcing a coach onto a worse-fitting ICP because our database is convenient would undermine the whole flow.

So each proposal carries a sourcing route, and the UI says plainly which one applies:

| Inventory | What we tell them |
|-----------|-------------------|
| Strong | "We have 4,200 of these — your list is ready in step 5." |
| Thin | "We hold ~120. We'll build the rest from Sales Navigator or a partner database." |
| None | "Not in our database yet. We'll source this one for you — it's the right target." |

Our house filter model, used as the default when nothing argues against it:

- Titles: Owner, CEO, Managing Director, Founder
- Team size: 11–50
- Revenue: £1–10M

The 215-document corpus confirms this is already what coaches target in practice, so it is a well-evidenced default rather than a house preference: 90% of documents name Owner, Founder, CEO or Managing Director; 93% of stated team sizes overlap 11–50; 94% of stated revenue bands overlap £1–10M. Where documents deviate, they stretch **upward** (£1–40M, a 400-headcount manufacturer), never below the band. Geography is overwhelmingly UK — 119 documents against 13 US.

Keep it adjustable per ICP, but the defaults can be confident.

### Step 3 — Ideal client (Profile → Avatar, facilitated)

Full structural analysis of the 215-document corpus is in [Ideal Client Avatar schema](./ideal-client-avatar-schema.md). Facilitation rhythm from Pam’s 1:1s is in [First Campaign — facilitated Ideal Client](./ideal-client-studio-plan.md).

**Decision:** One wizard path only — do **not** ship a separate “Ideal Client Studio.” Step 3 is where facilitation lives.

**The Profile and the Avatar are two artifacts, generated in that order, with confirm between them.** The Profile defines the market. The Avatar is one human inside it. Pam’s rule: use the **edited** Profile to create the Avatar.

| | |
|---|---|
| Coach does | Confirms Profile sections (lean set), then Avatar beats; edits; saves slices to brain |
| System does | Profile only → wait for lock → Avatar from edited Profile; progress UI between generates |
| Brain model | Show → confirm → save to brain (section picker). Working docs on `coach_avatars`; confirmed slices → `profiles.ai_context` |
| Downstream | Same avatar feeds messages (step 4) and later newsletter/content |
| New | Split generate APIs; section confirm UI inside this step (not a second product) |

**What the corpus can and cannot give us.** Language analysis (full detail in [Ideal client language patterns](./ideal-client-language-patterns.md)) found that 113 of the 215 documents share the same ChatGPT-produced skeleton, and only 20 of 215 contain a single trade-specific noun — "lads", "top billers", "sheds", "WIP", "covers", "debtor days". So the archive is an excellent source of *universal* owner pain and a poor source of the *industry vocabulary* the connection-message playbook actually demands. Treat universal pain, objections and buying triggers as solved defaults harvested from the corpus, and treat per-industry vocabulary as the one thing that needs building from scratch. That vocabulary layer is what decides whether generated copy passes the playbook's red-flag test for generic language.

**Desire is the pain inverted.** Across the corpus the desire sections are almost never independent research — they are the pain sentence turned around. "Why does everything still come back to me?" becomes "the business runs well without me being everywhere." That halves the research surface: generate one researched pain per industry stated in that industry's nouns, then derive `{main_desire}` by negation. It also guarantees the hook and the proof line share vocabulary, which is exactly what the connection message needs.

The generator has to respect the voice rules per section, since that is what separates a believable avatar from generic coaching copy. Triggers are third-person descriptive; Specific Problem and Internal Monologue are first-person and quoted; Reality is present-tense and cinematic. Two distinctions to enforce: Challenges are external and structural while Fears are emotional, and the Internal Monologue ends in confusion while the outward-facing Quote ends ready to act. There is also a self-awareness ceiling — one coach correction in the archive reads *"Steve wouldn't say 'I can't keep leading like this', he wouldn't have that degree of self-awareness"* — so the monologue must sit at the persona's level of insight, not the coach's.

Build the schema on the "25 Psychological Triggers + Bring It to Life" template, which is the only one of the three generations with a stable field list, then layer on the newer sections worth keeping: messaging hooks, buying triggers, what keeps them awake at night, and `WHO THIS IS NOT FOR`. That last one appears in only three documents but disqualifiers sharpen targeting more than another pain bullet does.

The brain today only holds `superpowers`, `hobbies_and_recent`, and `client_results[]`. Avatar output needs new keys on `ai_context` — at minimum ICP description, pain language, industry vocabulary, and proof framing.

### Step 4 — Draft messages

| | |
|---|---|
| Coach does | Reviews two connector variants and two follow-ups; edits; approves |
| System does | Generates from ICP + avatar + their proof, following the existing playbook structure |
| Exists | `linkedin_connector` skill, `src/knowledge/connection-messages.md`, `follow-up-campaigns.md`, `connector-message-feedback.csv` |
| New | Bind generation to the chosen ICP and saved avatar; store approved messages as a campaign asset |

Personalisation is token-shaped, matching the existing playbook rather than open-ended research:

```
Hi {first_name},
I see you run a {country} {industry} company.
Are you looking to {main_desire}?
I ask because {proof}.
Is this of interest?
```

The generator should self-check against the existing 10-step checklist and red flags before showing a draft.

### Step 5 — Build starter list

| | |
|---|---|
| Coach does | Builds a cold list from Lead Finder **and/or** uploads LinkedIn Connections.csv (warm) |
| System does | Prefills Lead Finder from ICP; parses Connections.csv; title-filters to ICP; optionally enriches shortlist |
| Exists | Lead Finder search/reveal; LinkedIn Basic export format documented in overnight plan |
| New | Coach Lead Finder access; Connections upload/match; optional Sales Nav CSV upload; list ownership; CSV export |

**Warm path insight:** the free Connections export already has title + company + profile URL. On a real ~6.5k export, title keywords alone surface hundreds of Owner/Founder/CEO/MD matches with zero enrichment. Company size / revenue is the enrichment gap — match Lead Finder first, then optional Apify on the shortlist only.

Ends with CSV handoff (Connect AI / Sales Robot later).

## 4. Data model

New tables (all RLS-scoped to the coach):

| Table | Purpose |
|-------|---------|
| `coach_campaign_setup` | Wizard state: current step, completion flags, timestamps |
| `coach_icps` | Chosen ICP: label, industry, geo, titles, size/revenue band, source filters |
| `coach_avatars` | Structured avatar: generated payload, coach-edited payload, approval state, link to ICP |
| `coach_campaign_messages` | Approved connector and follow-up copy, variant label, linked ICP |
| `coach_lead_lists` + `coach_lead_list_items` | Saved starter list and its members |
| `icp_avatar_library` | Curated avatars from existing Drive docs, keyed by industry, used to seed step 2 and 3 (see §6) |

Extend `profiles.ai_context` with the avatar-derived keys, keeping the existing partial-merge behaviour in `mergeCoachAiContext`.

## 5. API surface

| Route | Purpose |
|-------|---------|
| `GET/PATCH /api/coach/campaign-setup` | Wizard state |
| `POST /api/coach/campaign-setup/icp-proposals` | Generate ICP options with inventory counts |
| `POST /api/coach/campaign-setup/avatar` | Generate avatar draft |
| `PATCH /api/coach/campaign-setup/avatar` | Save edits, approve, write the brain half |
| `POST /api/coach/campaign-setup/messages` | Generate message variants |
| `GET/POST /api/coach/lead-finder/search` | Coach-scoped Lead Finder |
| `POST /api/coach/lead-lists` | Save starter list |
| `GET /api/coach/campaign-setup/export` | Pack export for Connect AI / Sales Robot |

## 6. Input needed from Zander

The corpus is extracted — 215 documents in `.ica-research/docs/` (gitignored), catalogued in `.ica-research/inventory.csv`, and analysed in [Ideal Client Avatar schema](./ideal-client-avatar-schema.md) and [Ideal client language patterns](./ideal-client-language-patterns.md).

### What the library can be seeded with

118 distinct coaches contributed. About 85% of the corpus (182 documents) is usable avatar or profile material; the rest is LinkedIn marketing output derived from an avatar, or blank templates.

18 industry buckets have 3 or more documents, covering 210 of 215 files. Ranked:

| Industry | Docs | | Industry | Docs |
|---|---|---|---|---|
| Manufacturing & Engineering | 33 | | Retail / E-commerce | 9 |
| SaaS & Software | 29 | | Financial Services & Insurance | 8 |
| Construction & Trades | 28 | | Food / Drink / Hospitality | 7 |
| Healthcare & Life Sciences | 19 | | Recruitment & HR | 7 |
| Local & General SME | 12 | | Distribution & Merchants | 6 |
| Professional Services | 11 | | Events & Weddings | 6 |
| Marketing & Creative Agencies | 10 | | Education & EdTech | 4 |
| IT & Managed Services | 9 | | Property & Facilities | 4 |

Launch with Manufacturing & Engineering, SaaS, and Construction & Trades — 28 to 33 documents each is enough to derive a consensus template plus variants. Logistics and Education are templatable but thin at 3–4. Genuine one-offs: Agriculture, Pet Services, Travel.

### Cleanup required before seeding

Three problems, all evidenced:

1. **Deduplicate first.** 13 files are named `Copy of…` / `OLD…` / `Revised…`, and 5 groups covering 11 files have byte-identical bodies.
2. **Documents contradict themselves.** They are ChatGPT transcripts that iterate, so superseded drafts sit alongside final answers. `Adam-Westbrook---Ideal-Client-Avatar.md` lists SaaS early, then argues in prose that a trades niche is much stronger. 18 of 118 coaches have documents spanning more than one industry — these need human review, not automated extraction.
3. **Filenames are unreliable** for both coach and niche. Take the coach from the `Member Folders/<Name>` path segment instead.

### Outstanding from Zander

1. **Confirm the target format** — the analysis recommends the "25 Psychological Triggers + Bring It to Life" structure with the newer sections layered on. Worth a sanity check against what you and Pam consider best.
2. **Pam's one-to-one transcripts**, if available, to see which questions produced the strongest sections. The archive shows the outputs but not the elicitation.
3. **Message first-line examples** and Connect AI export format — can land after overnight on top of editable prompts.

Brain model is resolved: show → confirm → save to brain (section picker). See [overnight plan](./first-campaign-overnight-plan.md).

The important design consequence of what you said: because you already have avatars covering most industries, step 3 should be **library-first**. Retrieve the closest existing avatar, then refine it against this coach's proof and market, rather than generating cold every time. That is faster, more consistent, and gets better as the library grows. Live web research becomes a top-up for gaps rather than the main engine.

## 7. Connection data — deliberately phase 2

What LinkedIn actually yields:

| Source | Data | Risk to their account | Have it |
|--------|------|----------------------|---------|
| Public profile scrape | Headline, about, experience, education, skills, connection **count** only | Low | Yes |
| Their 1st-degree connections | Names, titles, companies | High — needs their session cookie | No |
| Sales Navigator search | Filtered lists, saved lists | High if cookie-scraped; low if they export CSV | No |
| Lead Finder corpus | Owners with email / phone / LinkedIn | None | Yes (admin only) |

A public profile scrape cannot see who someone is connected to. So "match my connections against my ICP" needs either their Sales Nav CSV export (safe, preferred) or cookie-based scraping (risky). Build the CSV-upload path first: same matching and personalisation pipeline, no account risk, and it proves the feature before we decide whether cookie scraping is worth it.

## 8. Phasing

| Phase | Scope | Outcome |
|-------|-------|---------|
| 1 | Steps 1, 2, 4, 5 with a stub avatar step | Wizard works end to end; demo-able |
| 2 | Step 3 built properly from the avatar library | The step that makes it feel bespoke |
| 3 | Connection CSV upload, matching, warm-list personalisation | "47 people you already know fit this ICP" |
| 4 | Optional cookie-based Sales Nav scrape, gated with risk warnings | Only if phase 3 proves demand |

## 9. Open questions

- Does the wizard live under Get Clients, or as its own onboarding route that Start Here links into?
- Reveal-cost budget per coach for the starter list, given reveals cost money
- Do we cap Lead Finder for coaches by list size, by reveals, or both?
- Does the campaign pack export target Connect AI, Sales Robot, or plain CSV first?
