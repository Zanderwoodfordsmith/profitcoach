/**
 * Distilled BCA Classroom playbook for building Sales Navigator prospect lists.
 * Sources (Get Calls → Client Compass):
 * - Build Your Base Search
 * - Build Your Ideal Prospect List
 * - Find More Prospects with Keyword Search
 * - Finding Ideal Clients Beyond Traditional Methods
 * (Blacklisting is out of scope for strategy generation — refine after import.)
 */

export const PROSPECT_SEARCH_PLAYBOOK = `
# BCA Sales Navigator Prospect Search Playbook

## Goal
Take the ~600k+ "base search" business owners in a geography and narrow to a high-quality ideal prospect list for automated connector outreach. Prefer the simplest method that works. Do NOT stack every idea into one mega-filter.

## Always start from the BASE SEARCH
Keep these on every Sales Nav strategy (unless expanding after exhaustion):
- Connections: 2nd + 3rd (for connector campaigns). Optionally check 1st later for warm outreach.
- Geography: usually country (UK) or US state / nearby states.
- Company headcount: 1–10, 11–50, 51–200 (sweet spot). Include 1–10 because many real 20–30 person firms are mislisted. Skip "Self-employed". 201–500 only if targeting larger.
- Current titles (include): Owner, co-owner, Founder, co-founder, CEO, Managing director, co-managing director, Managing partner, co-managing partner (+ industry-specific titles e.g. Head Architect).
- Exclude on BOTH Current Company AND Current Title (unless that IS the niche): coach, coaching, consultant, consulting, consultants, psychologist, recruiter, recruiting, recruitment, recruit.
- Zander rarely uses the LinkedIn Industry filter — prefer Current Company name / Keywords.

Save reusable searches: "Base Search – [Location]", then "[Industry] prospects – [count]".

## Strategy ladder (try in order — one primary narrowing at a time)

### 1) CURRENT COMPANY name (favourite / primary)
Put the industry / business type and ALL useful variations into Current Company (INCLUDED).
- Phrases need quotes: "IT Solutions", "law firm".
- Variations matter: engineering + engineers + engineer (engineering alone often dominates results).
- Attached naming words: dentists → dentist, dentistry, teeth (smile often too noisy / personal-growth).
- Trades: electrician / electricians / plumbing / plumber (watch 1-man bands).
- Law: law, "law firm", legal, lawyer, lawyers.
- Architect: architect / architects / architecture.

Quality bar: spot-check page 1, then page 3/5 — aim ~7–8/10 good matches (company name + seniority). List size ideally 500+ (600+ supports A/B). Thousands is fine — months of outbound.

If the list includes a subtype you don't want, EXCLUDE that word (e.g. law include + commercial exclude).

### When company-name DOESN'T work
Not every industry puts the industry word in the company name.

**Example — drinks / FMCG (category-rich):**
- "drink" / "drinks" → tiny lists; brands often don't use those words (e.g. company named "Chai").
- Go WIDER on market (drinks → food / FMCG) but MORE SPECIFIC on naming words that DO appear: cookies, crisps, chips, coffee, wine, wines, spirits, beverage(s), chocolate, beer, gin…
- Create SEPARATE lists per strong naming word when they produce clean lists (wine alone can be 1000+ and worth saving as its own search).
- "food" alone often pulls wholesalers / importers / exporters — too broad or wrong.

**Name-poor industries (e.g. many software / services firms):**
- Industry word rarely in company name → skip or quickly abandon company-name includes.
- Move to Keywords (strategy 2). May ask member for 3 ideal profile examples.

### 2) KEYWORDS (only if company-name lists too small / exhausted)
- REMOVE Current Company INCLUDE (green) terms first. Keep the base EXCLUDES (coach/consultant red). Leaving includes on + keywords over-constrains (tiny intersection).
- Keywords scan the ENTIRE profile (headline, about, experience) → noisier. Example: "Energy Drinks" can match a sock-company MD who "loved energy drinks" 20 years ago.
- Quality bar drops to ~40–50% keepers. Save good ones to Lead Lists, then combine into a SEARCH (automation imports searches, not raw lead lists).

**How to find keywords:**
1. Open ~3 ideal profiles (from a small company-name list or known clients).
2. Hunt industry-specific words others won't use. Prefer Specialties / niche nouns over generic business words ("content strategy", "business planning" are useless).
3. ALWAYS test a promising new word back in Current Company first — if it works there, prefer that (higher quality). Wine/wines from a drinks profile is the classic win.
4. Then use Keywords bar with Boolean.

**Boolean (Keywords bar):**
- Quotes: exact phrase — "Food Safety"
- AND: both required (often implicit if two bare terms)
- OR: either
- NOT: exclude
- Parentheses for grouping
- Precedence: Quotes → () → NOT → AND → OR
- Example: spirits AND (whiskey OR whisky OR vodka OR tequila OR gin)
- Example hard niche: ("cloud" AND services) NOT (importer OR exporter)

**Lead lists → combined search:**
- Small high-precision keyword hits → Save to List page by page.
- Only combine lists that share a messaging bucket (cookies + chips + crisps → "snacks"; wine + candy is usually too different for one message).
- Blank search → Lead Lists include A + B → Save as search with count in the name.

**Expand only if still stuck:** relax headcount, then geography. Ask community with a screenshot of filters/keywords.

### 3) BEYOND LINKEDIN (last resort / later expansion)
Only if LinkedIn can't yield enough, or after months of exhausting SN lists:
- Apollo / similar databases (still need LinkedIn URLs for connector automation).
- LinkedIn Groups aligned to ICP (check seniority).
- Associations, directories, events, niche sites (e.g. TripAdvisor for hospitality).
- JV / association intros.
Most coaches should NOT start here.

## Naming-pattern classifier (use this before inventing filters)
- **name_rich**: industry word commonly in company names → lead with company_name variations (engineering, plumbing, dentistry, electricians, architects, many trades).
- **category_rich**: umbrella word rare in names, but product/category words appear → lead with category_name lists (FMCG, drinks, food brands, snacks…).
- **name_poor**: almost never in names → skip company includes; keywords + 3 sample profiles (software, many generic "services", some agencies).
- **mixed**: try a short company_name pass, then category or keywords.

## Output rules for the AI strategist
- Always assume base search is already applied by the product.
- Return 2–4 strategies ranked by priority. First strategy should be the best FIRST move (usually company_name / category_name, not keywords).
- Each strategy is a SEPARATE idea — do not merge company includes + keywords in one strategy.
- For company/category strategies: populate companyIncludes with concrete terms (singular/plural/ing + attached words). Use quotes in terms when multi-word.
- For keywords strategies: companyIncludes MUST be empty; keywordsBoolean required.
- beyond_linkedin only if name_poor / exhausted and useful; no fake SN filters.
- Prefer multiple focused company lists over one bloated OR of unrelated categories.
- If sample profiles would unlock keywords, set sampleProfilesNeeded=true and say what to look for.
- Be concrete and coach-facing — terms they can paste, not vague advice.
`.trim();
