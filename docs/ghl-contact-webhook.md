# GHL Contact ID Webhook Setup

Inbound webhook for GoHighLevel (Pro Coach Platform) workflows. Handles two cases:

1. **Profit Coach → GHL** — after a prospect is created from our outbound lead webhook, GHL POSTs the CRM contact id back so we store it on `contacts.crm_contact_id` (for “Open in CRM” links).
2. **GHL → Profit Coach** — when a contact is created manually in GHL (or any source without a Profit Coach `contact_id`), the same endpoint **creates a new prospect** for the coach matched by `location_id`.

## Endpoint

| Setting | Value |
|---------|-------|
| **Method** | `POST` |
| **URL** | `https://<your-production-app-domain>/api/webhooks/ghl/contacts` |
| **Health check** | `GET https://<your-production-app-domain>/api/webhooks/ghl/contacts` → `{ ok: true, configured: true }` |

## GHL: paste this URL

Use **POST** with a JSON body (see workflow section below).

```
https://<your-app-domain>/api/webhooks/ghl/contacts?secret=<your-secret>
```

Production example (same secret pattern as appointments):

```
https://theprofitcoach.com/api/webhooks/ghl/contacts?secret=pc-ghl-wh-8f3k2m9x7q1v4n6p
```

## Environment variable

Set **`GHL_CONTACT_WEBHOOK_SECRET`** on Vercel (any long random string). If omitted, the endpoint falls back to **`GHL_APPOINTMENT_WEBHOOK_SECRET`**, so you can reuse the same secret as the appointments webhook.

Redeploy once after setting the env var.

## Alternative: header auth

```http
Authorization: Bearer <your-secret>
```

URL can then omit `?secret=`.

## GHL workflow configuration

Add this **after** the step that creates/updates the contact from our inbound lead webhook (see `docs/ghl-lead-webhook.md`), **or** on a **Contact Created** trigger for manual GHL adds.

1. **Trigger:** Inbound Webhook (same workflow that receives Profit Coach leads), **or** Contact Created / Contact Updated if you prefer a separate workflow.
2. **Action:** Webhook (custom outbound)
3. **Method:** POST
4. **URL:** (see above)
5. **Content-Type:** `application/json`
6. **Body** — map these fields from the workflow (exact variable names depend on your GHL builder):

```json
{
  "crm_contact_id": "{{contact.id}}",
  "profit_coach_contact_id": "{{inboundWebhookRequest.contact_id}}",
  "email": "{{contact.email}}",
  "first_name": "{{contact.first_name}}",
  "last_name": "{{contact.last_name}}",
  "phone": "{{contact.phone}}",
  "location_id": "{{location.id}}"
}
```

For **Contact Created** workflows (manual GHL add), omit `profit_coach_contact_id` but **include `email`** — it is required to create the prospect.

### Accepted JSON keys

| Purpose | Preferred key | Alternatives |
|---------|---------------|--------------|
| CRM / GHL contact id | `crm_contact_id` | `ghl_contact_id`, non-UUID `contact_id`, non-UUID `id` |
| Profit Coach contact id | `profit_coach_contact_id` | `pc_contact_id`, UUID `contact_id` |
| Name | `full_name` | `first_name`, `last_name` |
| Phone | `phone` | — |
| Business | `business_name` | `company_name` |
| Match fallback | `email` | Required when creating from GHL |
| Coach scope | `location_id` | `location.id` |

**Matching order:**

1. `profit_coach_contact_id` → `contacts.id` (best — we send this on every outbound lead webhook as `contact_id`)
2. `crm_contact_id` → existing row already linked
3. `location_id` + `email` → coach via `coaches.crm_location_id`, then contact by email
4. If still unmatched and no `profit_coach_contact_id` was sent → **create prospect** (requires `email` + resolvable coach via `location_id`)

### Response examples

Link existing prospect:

```json
{ "ok": true, "contact_id": "<uuid>", "crm_contact_id": "...", "match_status": "matched", "created": false }
```

Create from GHL:

```json
{ "ok": true, "contact_id": "<uuid>", "crm_contact_id": "...", "match_status": "created", "created": true }
```

Missing email on create:

```json
{ "ok": false, "match_status": "unmatched_contact", "error": "Email is required to create a prospect from GHL..." }
```

## Per-location rollout

Duplicate the outbound webhook action in **each coach GHL sub-account** (location), or run it from a workflow that already receives location-scoped inbound leads. All locations POST to the **same URL**.

Ensure each coach row has `crm_location_id` set when using email + location matching.

## Testing

1. Deploy with secret env var set
2. Confirm health: `curl https://theprofitcoach.com/api/webhooks/ghl/contacts`
3. Local parsing smoke test:

```bash
npx tsx scripts/test-ghl-contact-webhook.ts
```

4. Local webhook test (dev server running):

```bash
curl -X POST 'http://localhost:3000/api/webhooks/ghl/contacts?secret=$GHL_APPOINTMENT_WEBHOOK_SECRET' \
  -H 'Content-Type: application/json' \
  -d @scripts/fixtures/ghl-contact-webhook-sample.json
```

Replace `profit_coach_contact_id` in the fixture with a real `contacts.id` from your database before expecting `ok: true`.

## Database

Migration: `supabase/migrations/20260725150000_contacts_crm_contact_id.sql`

- Column: `contacts.crm_contact_id` (text, nullable)

## CRM link format

Once stored:

```
https://app.procoachplatform.com/v2/location/{coaches.crm_location_id}/contacts/detail/{contacts.crm_contact_id}
```

Helper: `buildCrmContactDetailUrl()` in `src/lib/ghlContactWebhook.ts`.

## Related docs

- Outbound lead webhook (Profit Coach → GHL): `docs/ghl-lead-webhook.md`
- Appointment webhooks: `docs/ghl-appointment-webhook.md`
