# Lead Finder (LeadRocks via Apify)

Admin-only experiment: search B2B leads with cache-first fills so repeat searches don’t re-pay Apify.

## Access

- Sidebar: **Admin → Lead Finder** (only allowlisted emails)
- Default allowlist: `zander@businesscoachacademy.com`
- Override: `LEAD_FINDER_ALLOWED_EMAILS` (comma-separated), or falls back to `CASH_FLOW_FORECAST_ALLOWED_EMAILS`

## Env

| Variable | Required | Description |
|----------|----------|-------------|
| `APIFY_TOKEN` | Yes | Same token as LinkedIn profile import |
| `APIFY_LEADROCKS_ACTOR` | No | Defaults to `rigelbytes/leadrocks-scraper` |
| `LEAD_FINDER_ALLOWED_EMAILS` | No | Who can open the tool |

Hard cap: **10 leads** per Apify fill (`LEAD_FINDER_MAX_ITEMS`). Local UK owners searches return the **exact match count** and one page of results (`LEAD_FINDER_PAGE_SIZE` = 100).

## Behaviour

1. Query `leadrocks_leads` for matching filters.
2. **UK Business Owners (local DB)** (`uk_business_owners`) — CSV import of MD/Founder/CEO/Owner exports. Filter by industry/title/location/team size with **no Apify**.
3. Other LeadRocks list slugs: if fewer than requested in cache, call Apify for the gap only, then upsert.
4. UI shows teasers; **Reveal** unlocks email / email2 / phone / phone2 / LinkedIn.

## Local CSV import

```bash
# Optional (promotes email_2 / phone_2 to real columns; until then they live in raw jsonb):
# npx supabase db push

npx tsx scripts/import-leadrocks-csv-to-leads.ts ~/Downloads
```

Imports `leadrocks_uk_{11_50|51_200|revenue}_mds_founder_ceo_owner*.csv` only (skips Campaign Prospects). Contact shape: 2 emails + 2 phones (second slot in `raw` until the migration is applied). Filename date (`_2026_08_03`) is stored as `exported_at` so we know how fresh the list is.

## Filters (admin probe)

- Default source is the local UK owners database.
- Apify list picker remains for filling gaps / niche verticals.
- If exact Apify filters miss, search auto-drops titles, then location, and returns a `note`.

## Migrations

- `supabase/migrations/20260914120000_leadrocks_leads_cache.sql`
- `supabase/migrations/20260921120000_leadrocks_leads_email2_phone2.sql`
