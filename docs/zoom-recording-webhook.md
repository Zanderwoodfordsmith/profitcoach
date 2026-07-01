# Zoom Recording Webhook Setup

Automatically attach Zoom cloud recordings to the community calendar when a recording finishes processing.

## Endpoint

| Setting | Value |
|---------|-------|
| **Method** | `POST` |
| **URL** | `https://www.theprofitcoach.com/api/webhooks/zoom/recordings` |

Use the `www` hostname — the apex domain (`theprofitcoach.com`) redirects POST requests with a 307, and Zoom will not follow that during validation.
| **Health check** | `GET https://<your-production-app-domain>/api/webhooks/zoom/recordings` → `{ ok: true, configured: true }` |

Replace `<your-production-app-domain>` with your deployed app host. **Use `www.theprofitcoach.com`, not the apex domain** — `theprofitcoach.com` redirects POSTs and Zoom validation will fail.

## Environment variables

Add these on Vercel (or `.env.local` for local testing):

| Variable | Required | Description |
|----------|----------|-------------|
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Yes | Secret token from your Zoom app’s **Event Subscriptions** feature |
| `ZOOM_ACCOUNT_ID` | No | If set, only recordings from this Zoom account are processed |

`SUPABASE_SERVICE_ROLE_KEY` must already be configured — the webhook uses the admin client to update calendar rows.

## Zoom app setup

1. In the [Zoom Marketplace](https://marketplace.zoom.us/), create a **Server-to-Server OAuth** app or **General** app with webhook support.
2. Open **Features → Event Subscriptions**.
3. Enable event subscriptions and add your endpoint URL:
   ```
   https://www.theprofitcoach.com/api/webhooks/zoom/recordings
   ```
4. Copy the **Secret Token** into `ZOOM_WEBHOOK_SECRET_TOKEN`.
5. Subscribe to:
   - `recording.completed`
6. Ensure the app has the scope:
   - `cloud_recording:read:recording` or `cloud_recording:read:recording:admin`
7. Save and validate the endpoint. Zoom sends an `endpoint.url_validation` challenge; the route responds automatically.

Optional: copy your Zoom **Account ID** from the app credentials page into `ZOOM_ACCOUNT_ID` so only your account’s recordings are attached.

## How matching works

When Zoom sends `recording.completed`, the app:

1. Verifies the `x-zm-signature` header using your secret token
2. Reads the meeting `start_time` and recording `share_url`
3. Expands community calendar events around that date
4. Finds the best matching occurrence using:
   - **Zoom meeting ID** from the calendar event’s `location_url` (strongest signal)
   - **Time window** — meeting start within 15 minutes before the event start and 60 minutes after the event end
5. Writes the share URL to:
   - `community_calendar_events.recording_link_url` for one-off events
   - `community_calendar_event_exceptions.recording_link_url` for recurring events

If a recording link is already set, the webhook leaves it unchanged.

If multiple events match equally, the webhook logs `ambiguous` and does not overwrite anything.

## Response examples

Attached:

```json
{
  "ok": true,
  "match_status": "attached",
  "event_id": "…",
  "occurrence_start": "2026-06-25T13:00:00.000Z",
  "event_title": "Wednesday Coach Call",
  "reason": null
}
```

No match:

```json
{
  "ok": true,
  "match_status": "unmatched",
  "event_id": null,
  "occurrence_start": null,
  "event_title": null,
  "reason": "No community calendar occurrence matched this recording."
}
```

## Testing

Parsing and matching smoke test:

```bash
npx tsx scripts/test-zoom-recording-webhook.ts
```

Local webhook test (dev server + ngrok or similar):

```bash
# Terminal 1
npm run dev

# Terminal 2 — use the same secret as ZOOM_WEBHOOK_SECRET_TOKEN
export ZOOM_WEBHOOK_SECRET_TOKEN="your-secret"
BODY="$(cat scripts/fixtures/zoom-recording-completed-sample.json)"
TS="$(date +%s)"
SIG="v0=$(printf 'v0:%s:%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$ZOOM_WEBHOOK_SECRET_TOKEN" | sed 's/^.* //')"

curl -X POST http://localhost:3000/api/webhooks/zoom/recordings \
  -H "Content-Type: application/json" \
  -H "x-zm-request-timestamp: $TS" \
  -H "x-zm-signature: $SIG" \
  -d "$BODY"
```

For URL validation during Zoom setup, use Zoom’s built-in **Validate** button in the Event Subscriptions UI.

## Tips for reliable matching

- Put the Zoom join link in each calendar event’s **Location URL** field
- Keep scheduled start times aligned with the actual Zoom meeting start
- With only a few calls per week, time-based matching is usually enough even without meeting ID links

## Deferred (optional later)

- Admin UI for unmatched recordings
- Slack notification when `match_status` is `unmatched` or `ambiguous`
- Allow replacing an existing recording when a newer one arrives
