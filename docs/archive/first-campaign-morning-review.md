# First Campaign Setup — morning review

Built overnight. Migrations applied and library seeded successfully. Wire-up hardened post-build.

## What’s live

| Piece | Status |
|---|---|
| Migration `20260922120000_first_campaign_setup.sql` | Applied |
| Migration `20260923120000_contacts_coaching_plan.sql` | Applied |
| `icp_avatar_library` seed (10 industries) | 10/10 OK |
| Wizard UI `/coach/first-campaign` + `/admin/first-campaign` | Built |
| Get Clients nav → “First Campaign” | Wired |
| APIs (campaign-setup, ICP, avatar, messages, connections, lead-finder, lead-lists) | Built + response-shape mapped |
| Prompt packs in `src/lib/firstCampaign/prompts.ts` | Editable |
| Brain keys + My brain “Campaign & ICP” section | Wired |
| Connections upload (CSV + LinkedIn export zip) | Wired |
| Export CSV (auth Bearer fetch → blob download) | Wired |
| `tsc --noEmit` | Clean |

## How to try it

1. Run the app (`npm run dev` if not already)
2. Open **Get Clients → First Campaign** (`/coach/first-campaign` or admin mirror)
3. Walk the five steps with a real LinkedIn URL + optional Connections.csv / export zip from Downloads

## Edit these first (prompts)

`src/lib/firstCampaign/prompts.ts`

- `ICP_PROPOSALS_SYSTEM`
- `PROFILE_SYSTEM`
- `AVATAR_SYSTEM`
- `MESSAGES_SYSTEM`

## Assumptions baked in

1. Route: `/coach/first-campaign`
2. Export: CSV first (Connect AI later)
3. Fit beats inventory on ICP proposals
4. Avatar = Gen A schema + newer extras
5. Connections: title-filter first; Lead Finder enrich on shortlist
6. Sales Nav: CSV upload path only (no cookie scrape)
7. DB access via pooler `aws-1-eu-west-2` + `SUPABASE_DB_PASSWORD` in `.env.local`

## Caps / cost controls (in place)

- Coach Lead Finder search: **cache/DB only** (no Apify fill), page size ≤ **100**
- Starter list items: ≤ **250** (warm or cold)
- Warm match return: ≤ **250** title matches
- Connections upload: ≤ **20,000** rows per batch

Still open before wide release: daily per-coach reveal/export quotas if contact data cost becomes an issue.

## Known gaps / watchouts

- **Library:** deep for Manufacturing / SaaS / Construction; light for 7 others — human-review before treating as gospel
- **Web research top-up:** not overnight; library + AI only
- **Connect AI / Sales Robot push:** not built; CSV export only
- Apply script overwrites env from `.env.local` (avoids stale-password bug)

## Wire-up fixes landed in this pass

- DB snake_case → wizard camelCase via `mapApi.ts` (ICP, avatar, messages, lead lists, connections)
- Warm table renders `first_name`/`linkedin_url` rows correctly after match
- Zip Connections upload accepted in UI; ICP role titles passed as `extraKeywords`
- Avatar confirm always sends `approve: true`
- Message approve only stamps selected variants (clears others)
- Export download uses session Bearer token (no naked `<a href>`)

## DB apply forever

```bash
npx tsx scripts/apply-migration-sql.ts supabase/migrations/<file>.sql
npx tsx scripts/seed-icp-avatar-library.ts
```

Needs `SUPABASE_DB_PASSWORD` in `.env.local` (already set).
