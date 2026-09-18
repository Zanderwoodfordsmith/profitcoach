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
| `ZOOM_RECORDING_MEETING_IDS` | No | Extra Zoom meeting IDs allowed besides the support personal room `7981269644` (comma-separated) |

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

The Zoom app is account-level, so every user on the Business Coach Academy Zoom account can fire `recording.completed`. Community-calendar ingest therefore also requires:

1. **Meeting ID** is the support personal room **7981269644** (`https://businesscoachacademy.com/calls`). Whoever started the room (support@, Pam, Zander, …) does not matter.
2. **Meeting start** is **14:45–17:00 Europe/London** (Monthly Momentum ~15:30, Win The Week / Profit Coach Training at 16:00)
3. **Duration**, when Zoom sends it, is **15–180 minutes**

These checks use the meeting’s `id` and `start_time` in the webhook payload, not when Zoom finished processing. Legitimate 4pm calls typically land on the calendar around **17:30–18:45 UK**.

## How matching works

When Zoom sends `recording.completed`, the app:

1. Verifies the `x-zm-signature` header using your secret token
2. Drops the recording unless the personal-room meeting ID, London start window, and duration checks above pass
3. Reads the meeting `start_time` and recording `share_url`
4. Expands community calendar events around that date
5. Finds the best matching occurrence using:
   - Meeting start within **45 minutes before** the slot start and **15 minutes after** the slot end
   - **Zoom meeting ID** from the calendar event’s `location_url` (score bonus; not enough on its own)
6. When several same-day calls match (notably first-Monday **Monthly Momentum** then **Win The Week**), assigns recordings in **chronological event order**: the earliest occurrence still missing a recording gets the next webhook
7. When the recording attaches to **Monthly Momentum** and same-day **Win The Week** still has no recording, **copies the same share URL** onto Win The Week (common when one continuous Zoom recording covers both)
8. Writes the share URL to:
   - `community_calendar_events.recording_link_url` for one-off events
   - `community_calendar_event_exceptions.recording_link_url` for recurring events

If a recording link is already set on the chosen occurrence, the webhook leaves it unchanged (and will prefer another open same-day slot when one exists). Exception: a Win The Week link that was mirrored from Monthly Momentum can be replaced if a second distinct recording arrives later.

If multiple events match equally and same-day ordering cannot decide, the webhook logs `ambiguous` and does not overwrite anything.

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

- Record in personal room **798 126 9644** (`/calls`). It is fine if Pam or Zander starts the room instead of support@
- Put the Zoom join link in each calendar event’s **Location URL** field when you have one (meeting ID is a score bonus)
- On the first Monday of the month, run Monthly Momentum before Win The Week so the first finished recording attaches to Momentum (and is copied to Win The Week). If you stop/start a second recording for Win The Week, that second webhook replaces the mirrored link.

## Deferred (optional later)

- Admin UI for unmatched recordings
- Slack notification when `match_status` is `unmatched` or `ambiguous`
- Allow replacing an existing recording when a newer one arrives
