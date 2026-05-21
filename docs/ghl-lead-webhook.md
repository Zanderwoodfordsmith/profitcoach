# GHL outbound lead webhook (Profit Coach → GHL)

The app POSTs JSON to each coach’s `coaches.lead_webhook_url` (GHL **Inbound Webhook** trigger). All funnel events for a coach share **one URL**.

## Snapshot test coach

| Field | Value |
|-------|--------|
| Slug | `profit-coach-snapshot` |
| GHL location ID (`crm_location_id`) | `nkMdG4ieburQlR9ypQYd` |
| Webhook URL | `https://services.leadconnectorhq.com/hooks/nkMdG4ieburQlR9ypQYd/webhook-trigger/UtLyJ7v3Vph4rBhSztbH` |

Create auth user `profit-coach-snapshot@businesscoachacademy.com` in Admin, then run migration `20260722120000_profit_coach_snapshot_coach.sql`.

## Branch on `status`

Use **`status`** in GHL workflow filters (not HTTP headers):

| `status` | When it fires | Typical GHL use |
|----------|----------------|-----------------|
| `contact_created_email` | Prospect submitted email on landing (no phone yet) | Early nurture / tag |
| `contact_created_phone` | Prospect added phone on landing | SMS / call workflow |
| `assessment_completed` | BOSS scorecard or diagnostic finished | Follow-up sequence |
| `scorecard_abandoned` | Prospect left BOSS scorecard mid-flow | Recovery sequence |

Legacy field **`event`** is still sent (`lead_captured`, `assessment_completed`, `scorecard_abandoned`) for older automations.

## Dedupe

- Prefer **`contact.contact_id`** (UUID) when present.
- Fallback: **`contact.email`** per coach.
- Email and phone steps may fire twice for the same person; branch on `status`, do not create duplicate contacts in GHL when IDs match.

## Payload shape (flat JSON for GHL)

The app POSTs a **flat** JSON object (no nested `contact` wrapper). Map workflow variables from top-level keys, e.g. `{{inboundWebhookRequest.email}}`, `{{inboundWebhookRequest.status}}`, `{{inboundWebhookRequest.boss_score}}`.

```json
{
  "event": "lead_captured",
  "status": "contact_created_email",
  "coach_slug": "profit-coach-snapshot",
  "coach_id": "<uuid>",
  "contact_id": "<uuid>",
  "email": "prospect@example.com",
  "phone": null,
  "first_name": "Jane",
  "last_name": "Doe",
  "full_name": "Jane Doe",
  "business_name": null,
  "source": "prospect_link",
  "fired_at": "2026-05-21T12:00:00.000Z"
}
```

`assessment_completed` (BOSS scorecard only) adds scores plus **flat GHL custom fields** (human-readable labels). Email/phone events do **not** include these — the prospect has not answered qualifying questions yet.

### GHL custom field mapping (`status: assessment_completed`)

Map these top-level JSON keys to your GHL location custom fields:

| JSON key | GHL custom field | Example value |
|----------|------------------|---------------|
| `annual_business_revenue` | Annual Business Revenue | `£500K to £1M` |
| `business_team_size` | Business Team Size | `2 to 5` |
| `years_in_business` | Years in Business | `3 to 5 years` |
| `boss_score` | Boss Score | `64` |
| `business_level_number` | Business Level Number | `3` |
| `business_level_name` | Business Level Name | `Organised` |
| `desired_outcome` | Desired Outcome | `More profit and income` |
| `tried_before` | Tried Before | `Hiring consultants or advisors, …` |
| `desired_support_type` | Desired Support Type | `Working with someone one-on-one` |
| `additional_info` | Additional Info | Free text from final screen |
| `focus_area_1` | Top focus area #1 | `Profit & Cash` |
| `focus_area_2` | Top focus area #2 | `Ops & Product` |
| `focus_area_3` | Top focus area #3 | `Revenue & Marketing` |
| `report_link` | Prospect report URL | `https://yoursite.com/assessment/profit-coach-snapshot/report?token=…` |

`report_link` is only sent on **`assessment_completed`** (BOSS scorecard). It is a permanent, shareable results page for that prospect. Set `APP_BASE_URL` in production so links use your real domain (not localhost).

Focus areas use the same ordering as the scorecard report: lowest scores first; ties favour **Velocity → Value → Vision → Foundation**, then question order within each pillar.

Legacy nested `qualifying` (raw option codes) and `answers` (per-question scores) are still sent for debugging and older automations.

## Troubleshooting empty / partial mapping

If GHL only shows `first_name` and `email` (or `content-length` ~47), the workflow did **not** receive the app payload. Common causes:

1. **Manual test in GHL** with a tiny sample body — use curl below with the full flat JSON.
2. **Zapier in the middle** (`User-Agent: Zapier`) — Zapier must forward the **raw JSON body** unchanged; a Formatter step often drops fields.
3. **Wrong variable paths** — use `{{inboundWebhookRequest.email}}`, not `contact.email` (we flatten contact fields to the root).
4. **Trigger not re-tested** after a new field was added — send a new webhook, then refresh mapping in the workflow builder.

## Manual test

GHL returns an error on GET with no body. POST flat JSON:

```bash
curl -X POST 'https://services.leadconnectorhq.com/hooks/nkMdG4ieburQlR9ypQYd/webhook-trigger/UtLyJ7v3Vph4rBhSztbH' \
  -H 'Content-Type: application/json' \
  -d '{"status":"contact_created_email","event":"lead_captured","email":"test@example.com","first_name":"Test"}'
```

## Revert default `/score` coach

Restore Pam in `src/lib/primaryCoach.ts` (remove TEMP comment block) or set env:

- `PRIMARY_COACH_EMAIL=pam@businesscoachacademy.com`
- `PRIMARY_COACH_SLUG=pam`
- `NEXT_PUBLIC_PRIMARY_COACH_SLUG=pam`
