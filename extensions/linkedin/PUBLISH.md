# Publish Profit Coach for LinkedIn

## Package

```bash
npm run pack:linkedin-extension
```

Upload `extensions/dist/profit-coach-linkedin-*.zip` to the Chrome Web Store developer dashboard.

## Checklist

1. Update version in `manifest.json` before each store submission.
2. Privacy URL: `https://www.businesscoachacademy.com/legal/linkedin-extension-privacy` (deploy app first).
3. Paste permission justifications from `STORE_LISTING.md`.
4. Screenshots: profile + side panel Save; optional Sales Nav session popup.
5. Soft launch: leave `EXTENSION_LINKEDIN_ALLOWED_EMAILS` unset (defaults to Zander) or set your email list.
6. Open rollout: set `EXTENSION_LINKEDIN_ALLOWED_EMAILS=*` (or `all`) in the app host env (Vercel).

## Database (required once)

Apply `supabase/migrations/20261011120000_contacts_linkedin_url.sql` before Save can store LinkedIn URLs:

```bash
npx supabase db push
# or, if CLI isn’t linked:
DATABASE_URL=postgresql://... npx tsx scripts/apply-contacts-linkedin-url.ts
# or paste the migration into the Supabase SQL Editor
```

## Local dogfood

1. Load unpacked from `extensions/linkedin`
2. Sign into Profit Coach as an allowlisted coach with marketing access
3. Open `/in/…` → Save → confirm prospect appears under Get Clients → Prospects / Pipeline
4. Draft connect note → Insert → confirm text lands in LinkedIn composer (you still click Send)
5. Sign in as a Core / Alumni test account → confirm side panel shows membership lock and APIs return 403

## Announce (after open rollout)

Tell programme / Premium / VIP coaches:

> Install **Profit Coach for LinkedIn** from [store link]. Keep Profit Coach open and signed in, open any LinkedIn profile, click the floating Profit Coach button, then Save to your pipeline or draft a note (you still hit Send on LinkedIn).
