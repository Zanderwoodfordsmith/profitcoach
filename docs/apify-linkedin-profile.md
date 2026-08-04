# LinkedIn profile import (Apify)

Coaches can import their public LinkedIn profile from Settings. The server calls Apify, stores a structured snapshot, and updates `profiles.linkedin_url`.

## Endpoint

| Setting | Value |
|---------|-------|
| **GET** | `/api/coach/linkedin/profile` — latest stored snapshot (no Apify call) |
| **POST** | `/api/coach/linkedin/profile` — scrape + save |

Auth: coach Bearer token (same as other coach APIs). Admins may use `x-impersonate-coach-id`. Admins may pass `{ "force": true }` on POST to bypass the 1-hour re-import cooldown.

POST body (optional):

```json
{ "linkedinUrl": "https://www.linkedin.com/in/example", "force": false }
```

If `linkedinUrl` is omitted, the coach’s saved `profiles.linkedin_url` is used.

## Environment variables

Add these on Vercel (or `.env.local` for local testing):

| Variable | Required | Description |
|----------|----------|-------------|
| `APIFY_TOKEN` | Yes | API token from [Apify Console → Integrations](https://console.apify.com/settings/integrations) |
| `APIFY_LINKEDIN_PROFILE_ACTOR` | No | Defaults to `harvestapi/linkedin-profile-scraper` |

The token must be able to run Actors via API (paid / API-capable Apify plan). The default actor mode is **Profile details no email** (~$4 per 1k profiles).

## Data

Snapshots live in `coach_linkedin_profiles` (`snapshot` normalized JSON, `raw` full Apify payload).

## Sales Navigator lead search (cookie)

Admin Lead Finder → **Sales Navigator** tab: generate a search URL from shared filters, then optionally import via Apify.

| Setting | Value |
|---------|-------|
| **POST** | `/api/admin/lead-finder/sales-nav-import` |
| Actor | `APIFY_SALES_NAV_ACTOR` or `harvestapi/linkedin-sales-navigator-lead-search-cookie` |
| Auth | Lead Finder allowlist + Bearer token |
| Inputs | `salesNavUrl`, `cookie` (Cookie-Editor JSON), optional `userAgent`, `takePages` (max 4) |
| Save | `{ save: true, leads: [...] }` persists to `coach_lead_lists` (`source: sales_nav`) without re-scraping |

Cookies are not stored. Prefer a secondary LinkedIn / Sales Nav login — cookie scrapes carry account risk.
