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

## Sales Navigator lead search

Admin Lead Finder → **Sales Navigator** tab: generate a search URL from shared filters, then import via Apify using BCA’s shared Sales Nav session (server-side only — coaches never paste cookies).

| Setting | Value |
|---------|-------|
| **POST** | `/api/admin/lead-finder/sales-nav-import` |
| Actor | `APIFY_SALES_NAV_ACTOR` or `harvestapi/linkedin-sales-navigator-lead-search-cookie` |
| Auth | Lead Finder allowlist + Bearer token |
| Inputs | `salesNavUrl`, optional `takePages` (max 100 ≈ 2,500 leads) |
| Save | `{ save: true, leads: [...] }` persists to `coach_lead_lists` (`source: sales_nav`) without re-scraping. Cap **250** today — backlog: raise cap + tighter campaign/list integration (shared `leadrocks_leads` cache already gets the full import on every scrape). |

| Variable | Required | Description |
|----------|----------|-------------|
| `LINKEDIN_SALES_NAV_COOKIE` | Optional | Server-wide fallback Cookie-Editor JSON (or `li_at=…`). Prefer per-user sessions via the Chrome extension. |
| `LINKEDIN_SALES_NAV_USER_AGENT` | No | Browser UA that matches the cookie session |
| `APIFY_SALES_NAV_COOKIE` / `APIFY_SALES_NAV_USER_AGENT` | No | Aliases for the above |

**Chrome extension** (unpacked): `extensions/linkedin` — Sales Nav session save into `sales_nav_sessions` via `PUT /api/sales-nav-session` (popup). Also Save-to-pipeline / draft notes via `/api/coach/extension/*`. Import order: request cookie → saved user session → env fallback.

Prefer a dedicated BCA Sales Nav account for shared scrapes — cookie scrapes carry account risk.
