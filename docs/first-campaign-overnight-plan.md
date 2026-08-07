# First Campaign Setup — overnight build plan

Approve with **go** before bed. This is what ships by morning.

## Product model (resolved)

There is no separate “brain vs coach-facing” content tree.

Flow for every generated artifact:

1. **Show** the coach the draft (ICP, avatar sections, messages, etc.)
2. **They confirm / edit**
3. **Save to brain** — either as part of step completion, or via the existing “Save to brain?” offer (pick which `ai_context` section)

Same pattern as Profit Coach AI today (`ProfitCoachAiWorkspace` → offer → My brain tab / section pick → `PATCH /api/coach/profile` with partial `ai_context` merge).

Implications:

- Avatar and Profile are **coach-visible working documents** first (`coach_icps`, `coach_avatars`)
- Confirmed slices become **brain fields** used by message gen, newsletters, later AI
- Unconfirmed draft never silently writes the brain
- Brain keys expand beyond today’s `superpowers` / `hobbies_and_recent` / `client_results[]`

## Activation (unchanged)

Done when the coach has:

1. LinkedIn imported  
2. One ICP chosen  
3. Avatar reviewed and confirmed slices saved to brain  
4. 3–4 messages approved  
5. Starter list of 100–250 leads  

## Overnight scope — full wizard, best effort

Not a stub. Not backend-only. Ship a runnable `/coach/first-campaign` (or under Get Clients) with all five steps wired.

### A. Database (apply via `npx supabase db push`)

| Table / change | Purpose |
|---|---|
| `coach_campaign_setup` | Wizard state, current step, completion flags |
| `coach_icps` | Chosen/proposed ICP + Lead Finder filter snapshot + sourcing route |
| `coach_avatars` | Profile + Avatar JSON (generated + edited + approved_at) |
| `coach_campaign_messages` | Connector + follow-up variants, approved flag |
| `coach_linkedin_connections` | Uploaded Connections.csv rows per coach |
| `coach_lead_lists` + `coach_lead_list_items` | Starter list ownership (`source`: lead_finder \| connections \| sales_nav_csv) |
| `icp_avatar_library` | Seeded industry templates (industry key, firmographics, pains, vocab, exemplar payload) |
| `profiles.ai_context` keys | Add: `ideal_client`, `industry_vocabulary`, `pain_language`, `messaging_hooks`, `proof_framing` (names may tweak; merge stays partial) |

RLS: coach owns their rows; library readable by authenticated coaches; admin write for library.

### B. Prompt packs (editable markdown / TS, not buried in UI)

| Prompt | Input | Output |
|---|---|---|
| `icp-proposals` | LinkedIn snapshot + library industries | 2–3 ICP cards + house filters + sourcing route |
| `ideal-client-profile` | Chosen ICP + coach LinkedIn proof | Profile artifact (market definition) |
| `ideal-client-avatar` | Profile + closest library hit + vocab layer | Avatar (25 triggers + Bring It to Life + newer extras) |
| `connector-messages` | ICP + confirmed avatar/brain + proof | 2 connector + 2 follow-ups, playbook-shaped |
| `brain-section-mapper` | Confirmed text | Which `ai_context` keys to offer |

Prompts live under something like `src/lib/firstCampaign/prompts/` so you edit copy in the morning without hunting components.

### C. Library seed (automated best effort)

From `.ica-research/`:

1. Dedupe `Copy of` / `OLD` / byte-identical  
2. Seed Manufacturing & Engineering, SaaS, Construction deeply  
3. Seed other 3+ industries lightly from inventory + language tables  
4. Attach vocabulary from `docs/ideal-client-language-patterns.md` where we have it  
5. Mark low-confidence industries for human review  

No Pam transcripts required for v1.

### D. APIs

| Route | Behaviour |
|---|---|
| `GET/PATCH /api/coach/campaign-setup` | Resume wizard |
| `POST …/linkedin` | Thin wrapper or reuse existing LinkedIn profile POST |
| `POST …/icp-proposals` | AI + inventory counts (info only, never a gate) |
| `POST …/icp` | Persist chosen ICP |
| `POST …/profile` + `POST …/avatar` | Generate Profile then Avatar |
| `PATCH …/avatar` | Edits; optional `saveToBrain: { keys }` |
| `POST …/messages` | Generate; `PATCH` approve |
| `POST /api/coach/lead-finder/search` | Coach-scoped Lead Finder (reuse admin search logic) |
| `POST /api/coach/connections/upload` | Parse Connections.csv / Basic export zip |
| `POST /api/coach/connections/match` | Title + ICP filter; optional Lead Finder / Apify enrich shortlist |
| `POST /api/coach/lead-lists` | Save 100–250 (cold or warm) |
| `GET …/export` | CSV pack (list + messages) — Connect AI later |

### E. UI — left rail + main tool

Route: **`/coach/first-campaign`**  
Nav: under Get Clients / Coach Tools (match existing hub patterns).  
Start Here can deep-link later; not blocking overnight.

| Step | Main panel |
|---|---|
| 1 LinkedIn | URL + scrape + snapshot summary (roles/sectors extracted) |
| 2 Choose ICP | 2–3 cards, inventory badge, pick one → generate Profile |
| 3 Avatar | Profile summary + Avatar sections; edit; **Confirm & save to brain** with section checkboxes |
| 4 Messages | 2+2 drafts; edit; approve |
| 5 Starter list | Dual source: Lead Finder cold list **or** Connections.csv warm match (+ optional Sales Nav CSV); save; export CSV |

AI chat is **light**: short coach notes per step (“Here’s why these three”), not a free-form agent. Half software, half guided AI — as briefed.

### F. Brain save UX

On avatar (and optionally messages/proof):

- Checkbox groups mapped to brain keys  
- Or modal: “Save to brain?” → pick sections → merge  

Reuse the existing offer tone; extend the brain form so new keys are visible/editable under My brain.

## Connections CSV + Sales Navigator (added)

LinkedIn’s official data export includes `Connections.csv` with:

| Field | Notes |
|---|---|
| First Name, Last Name | Always present |
| URL | Profile URL — join key for enrichment |
| Email Address | Often empty (privacy setting) |
| Company | Current company string |
| Position | Current title — strong free filter |
| Connected On | Date |

Sample export (`Basic_LinkedInDataExport_08-03-2026`): **6,489 connections**. Title keyword hits alone (not mutually exclusive): Founder ~961, Director ~1,220, CEO ~342, Owner ~302, Co-founder ~158, Managing Director ~219.

**What it does *not* include:** company size, revenue, industry. Those need enrichment or Sales Nav.

### What we do with it (product decision)

**Overnight (in scope):** Connections CSV upload as a **warm-list path** next to cold Lead Finder.

1. Coach uploads LinkedIn `Connections.csv` (or the whole Basic export zip; we pull `Connections.csv`)
2. Parse past the Notes header block
3. Filter by ICP title keywords (Owner / Founder / Co-founder / CEO / Managing Director / MD) + optional company-name / industry keyword hints
4. Show: “You already know **N** people who look like this ICP”
5. Save as a warm starter list (or merge into the campaign list)
6. Messages use warm framing where appropriate (still playbook-shaped; personalisation tokens from name/company/title)

This alone is high value and **needs no Apify spend**.

**Enrichment waterfall (overnight best effort for shortlist only):**

| Priority | Source | Gets | Cost / risk |
|---|---|---|---|
| 1 | Match URL / name+company against `leadrocks_leads` | Email, phone, team size, revenue, industry if already cached | Free |
| 2 | Optional Apify profile enrich on **title-filtered shortlist** (cap e.g. 50–100) | Headline, about, experience; sometimes company clues | Paid; low account risk (public profiles) |
| 3 | Company-size / revenue from LeadRocks or later company enrich | Firmographics for the £1–10M / 11–50 band | Paid; only after title filter |

Do **not** enrich all 6k overnight. Title filter first → enrich the matches.

Company size / revenue remains the ideal ICP gate, but **title match is enough to ship the warm path**. Missing firmographics = “likely fit — confirm” not discard.

### Sales Navigator — two different jobs

| Job | Who | Overnight? | Notes |
|---|---|---|---|
| **A. Coach list source** | Each coach | Thin support | Accept Sales Nav CSV / lead-list export as an alternate upload next to Connections + Lead Finder. Same list pipeline. |
| **B. Central BCA Sales Nav** | Ops / admin | Plan only, not build | One shared Sales Nav used to **fill industry inventory** into Lead Finder / library (export → import), not to scrape via coach cookies. Safer, controllable, matches “centralise one Sales Navigator.” |

Cookie-based Sales Nav scraping stays **out** of overnight (account risk). Prefer native export → CSV upload.

### Where this sits in the wizard

Step 5 becomes dual-source:

```
Starter list
├── Cold: Lead Finder (prefilled from ICP)
└── Warm: Upload Connections.csv → title/ICP match → optional enrich shortlist
```

Optional later: “Also import a Sales Navigator export” as a third tile.

Not a 6th step overnight — keep five steps; upload lives inside step 5 (and can be re-run from Get Clients).

## Assumptions if you say go (morning overrides)

| # | Assumption | Why |
|---|---|---|
| 1 | Route is `/coach/first-campaign` | Clear, resumable |
| 2 | Export = CSV first | Connect AI format unknown |
| 3 | Coach Lead Finder: list save up to 250; reveals capped | Protect Apify cost |
| 4 | Connections CSV: title-filter first; enrich ≤100 matches via Lead Finder match then optional Apify | Firmographics nice-to-have |
| 5 | Sales Nav: accept CSV upload; central BCA Sales Nav = ops note only | No cookie scrape overnight |
| 6 | Avatar format = Gen A schema + Gen B/C extras | Corpus evidence |
| 7 | Fit beats inventory | Already agreed |
| 8 | Web research = optional later; overnight = library + AI | Reliability |
| 9 | Cookie connection / Sales Nav scrape = not overnight | Phase 2 |

## Explicitly out of overnight scope

- Cookie-based connection / Sales Nav scrape  
- Running a live central Sales Nav account / automation (document the ops pattern only)  
- Connect AI / Sales Robot API push  
- Enriching entire connection graphs (shortlist only)  
- Pam transcript ingestion  
- Perfect library curation for all 18 industries (deep 3 + light rest)  
- Pixel-perfect design polish  
- Full free-chat “campaign co-pilot”  

## Morning review pack

You’ll get `docs/first-campaign-morning-review.md` listing:

- What ran / what failed  
- Every assumption  
- Prompt file paths to edit first  
- Library industries seeded + confidence  
- Manual test checklist (5 steps)  

## Success criteria (wake-up test)

1. Coach pastes LinkedIn → snapshot lands  
2. Sees 2–3 ICPs with inventory labels → picks one  
3. Sees Profile + Avatar → confirms → brain fields populate  
4. Sees message drafts → approves  
5. Builds cold list **and/or** uploads Connections.csv → sees warm matches → saves list → CSV  

If any step’s AI fails, UI still saves partial state and shows a clear error — wizard remains resumable.

## Build order overnight

1. Migrations + types + push  
2. Prompt packs + Anthropic generate helpers  
3. Library seed script  
4. APIs  
5. Wizard UI shell + step components  
6. Brain form extensions + save modal  
7. Wire Lead Finder coach path + Connections.csv upload/match  
8. Morning review doc + smoke notes  

## What I need from you before bed

Just one of:

- **go** — build the plan above  
- **go, but …** — e.g. “no coach Lead Finder yet”, “put under /coach/get-clients”, “reveal cap 50”  

No more product decisions required for overnight. Message examples and Connect AI format can land tomorrow on top of editable prompts.
