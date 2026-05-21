# GHL Appointment Webhook Setup

Inbound webhook for GoHighLevel (Pro Coach Platform) **Appointment Status Changed** workflows. Stores appointment lifecycle data and links bookings to platform contacts via email + coach scope.

## Endpoint

| Setting | Value |
|---------|-------|
| **Method** | `POST` |
| **URL** | `https://<your-production-app-domain>/api/webhooks/ghl/appointments` |
| **Health check** | `GET https://<your-production-app-domain>/api/webhooks/ghl/appointments` → `{ ok: true, configured: true }` |

Replace `<your-production-app-domain>` with your deployed app host (e.g. Vercel production URL).

## GHL: paste this URL

Use **POST** (GHL default for webhook actions).

```
https://<your-app-domain>/api/webhooks/ghl/appointments?secret=<your-secret>
```

Replace `<your-app-domain>` with where the app is hosted (e.g. your Vercel URL or custom domain).

Replace `<your-secret>` with the same value you set in Vercel as `GHL_APPOINTMENT_WEBHOOK_SECRET` (any long random string). Example:

```
https://app.example.com/api/webhooks/ghl/appointments?secret=pc-ghl-wh-8f3k2m9x7q1v4n6p
```

No custom headers or body fields needed in GHL — just that URL.

## One-time setup on Vercel (not GHL)

Add environment variable `GHL_APPOINTMENT_WEBHOOK_SECRET` with the same secret (without `?secret=`). Redeploy once. This turns the endpoint on; GHL only needs the full URL above.

## Alternative: header auth

If your GHL webhook action supports custom headers instead:

```http
Authorization: Bearer <your-secret>
```

URL can then omit `?secret=`.

## GHL workflow configuration

1. **Trigger:** Appointment Status Changed (covers booked, confirmed, cancelled, showed, no-show, rescheduled, etc.)
2. **Action:** Webhook
3. **Method:** POST
4. **URL:** (see above)
5. **Custom header:** `Authorization: Bearer <secret>`
6. **Body:** Default — do **not** add custom fields. GHL automatically includes contact fields plus nested `location` and `calendar` objects when the trigger is appointment-related.

## Per-location rollout

Duplicate the same workflow in **each coach GHL sub-account** (location). All locations POST to the **same URL**. The platform resolves the coach via:

1. `location.id` → `coaches.crm_location_id` (primary)
2. `calendar.id` → `coaches.ghl_calendar_id` or embed widget id fallback

Ensure each coach row in Admin → Coaches has `crm_location_id` set before expecting auto-linking.

## Prospect matching

No prospect-facing IDs required. On each webhook:

- Email from contact fields is matched to `contacts` scoped by resolved `coach_id`
- Latest assessment for that contact is attached when found
- Unmatched rows are still stored with `match_status` of `unmatched_coach` or `unmatched_contact`

## Testing

1. Deploy with `GHL_APPOINTMENT_WEBHOOK_SECRET` set
2. Confirm health: `curl https://<domain>/api/webhooks/ghl/appointments`
3. In one coach location, use GHL **Test Webhook** on the action
4. Verify row in `ghl_appointments` (Supabase) and inspect `raw_payload`
5. Book or change status on a test appointment; confirm the same row updates (same `ghl_appointment_id`)
6. Roll out workflow to remaining coach locations

Local parsing smoke test:

```bash
npx tsx scripts/test-ghl-appointment-webhook.ts
```

Local webhook test (dev server + ngrok):

```bash
curl -X POST http://localhost:3000/api/webhooks/ghl/appointments \
  -H "Authorization: Bearer $GHL_APPOINTMENT_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d @scripts/fixtures/ghl-appointment-webhook-sample.json
```

## Database

Migration: `supabase/migrations/20260721120000_ghl_appointments.sql`

- Table: `ghl_appointments` (upserted on `ghl_appointment_id`)
- Column: `coaches.ghl_calendar_id` (auto-set when coach saves calendar embed code)

## Deferred (Phase 2)

- Coach UI tab for upcoming/past calls
- Admin aggregate booking metrics
- Funnel auto-fill from `ghl_appointments`
