# LinkedIn Connect (Profit Coach) — private Apify Actor

Sends LinkedIn connection requests using a session cookie (`li_at`). Optional per-profile notes. **Private / pilot use** — not a Store product.

## Input

| Field | Required | Notes |
|-------|----------|--------|
| `cookies` | Yes | Cookie-Editor **Export as JSON**, or `li_at=…; …` |
| `profiles` | Yes | `[{ "url": "https://www.linkedin.com/in/…", "message": "optional note" }]` |
| `userAgent` | No | Match the browser that created the cookie |
| `delaySeconds` | No | Default `8` (actual wait is random between delay and 2×) |
| `dryRun` | No | If `true`, opens Connect UI but does not Send |

## Local run

```bash
cd actors/linkedin-connect
# Put input in storage/key_value_stores/default/INPUT.json
apify run
```

Example `INPUT.json`:

```json
{
  "cookies": "[ /* Cookie-Editor JSON */ ]",
  "profiles": [
    { "url": "https://www.linkedin.com/in/example/", "message": "Hi — quick note." }
  ],
  "delaySeconds": 8,
  "dryRun": true
}
```

## Deploy

```bash
cd actors/linkedin-connect
apify login   # once
apify push
```

Then run from Apify Console, or call with `APIFY_TOKEN` + actor id `~linkedin-connect` (or your username prefix).

## Wire into Profit Coach later

App already has Apify patterns + extension cookies. After this actor works on your account, a thin `src/lib/apify/linkedinConnect.ts` + admin test button is a small follow-up.
