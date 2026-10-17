# Overnight build: Ava replies, lead quality, group tests, coach health (17 to 18 Oct 2026)

Branch: `ava-copilot` in a separate worktree (`../profit-coach-app-ava`). Nothing pushed. Two additive migrations applied to the live database (new tables and columns only).

## 1. Ava replies: fast copilot and autopilot

**What changed**
- Ava now runs from the live Unipile message webhook, seconds after a LinkedIn reply lands. Before, she only ran on the hourly inbox sync.
- **Copilot (default for every coach):** classify the reply, draft an answer, alert the coach by:
  - phone push (the app is now installable: manifest, icons, service worker),
  - BCA's own WhatsApp (outside 9pm to 7am in the coach's time zone),
  - email to themselves (off by default).
  The alert opens the exact conversation (`/coach/conversations?conversation=<id>`), where an "Ava" bar shows her suggestion with **Use draft**.
- **Autopilot (off everywhere):** runs only when the global switch, your per-coach allow and the coach's own choice are all on, the reply is under 2 hours old, Ava is at least 85% sure (adjustable per coach) the prospect wants a call, and Ava hasn't already replied in that thread this week. She offers two real free times from the coach's calendar, sent about 75 seconds later through the scheduled-message queue, so the coach can cancel. If there's no reply for 48 hours, one nudge with the booking link. Never more than one.
- Time rules: `content/ai-knowledge/reply-copilot/booking-times.md`. Two times, two different days, one morning and one afternoon, inside 1 to 3 working days, at least 3 hours away. Tuesday to Thursday 10:00 to 11:30 or 14:00 to 15:30 preferred. Never Monday morning, Friday afternoon, lunch or weekends.
- Calendars: native coaches use our availability plus Google busy times. GHL coaches use GHL's free-slots API once a token exists. Until then they get the booking link instead of guessed times.
- When a prospect picks a time, Ava alerts the coach to confirm it (new step "Confirm their time") with a draft. She does not book it herself yet.

**Where to see it:** coach Today tab ("Ava replies" card); your Admin, Ava, Reply review (new "Alerts and autopilot" panel).

**Tested:** unit tests for slot picking, autopilot rules and offer wording. Dry run against real calendars: Zander Demo would get "Tuesday at 10am or Wednesday at 2pm (UK time)"; GHL coaches fall back to the link.

**You need to do**
1. Add to Vercel: `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` (values are in `.env.local`).
2. Connect BCA's WhatsApp: Admin, Ava, Reply review, "Connect BCA WhatsApp (scan QR)".
3. For GHL times: add `GHL_API_TOKEN` (an agency token that can read every sub-account), or `GHL_LOCATION_TOKENS` as JSON `{ "<locationId>": "<token>" }`.
4. Coaches need a mobile number on their profile for WhatsApp alerts.
5. iPhone push only works once the coach adds the app to their home screen (iOS 16.4+). The card explains this.

## Decisions I made (overturn any of these)
- Autopilot needs three switches (global, per-coach allow, coach choice). All off tonight.
- Autopilot only answers fresh replies (under 2 hours) and only clear "let's talk" replies. Questions, "tell me more" and objections stay copilot.
- Sends go through the existing scheduled-message queue with a ~75 second delay, so they look human and can be cancelled.
- One nudge only, after 48 hours, with the booking link. The old scorecard-first "Reply interested" sequence isn't used after a time offer, because it would contradict it.
- WhatsApp alerts come from one BCA number, not the coach's own WhatsApp. Coach email alerts are opt-in.
- Ava does not book calls into calendars yet. She hands that to the coach with a draft.

## 2. Campaign and lead quality

**What changed**
- **Active people first.** When a list goes into a campaign, the order is: newest import first, then Open Profile, then Premium, then Sales Navigator's own best-match order. The Pool's default "import order" sort does the same, and so does queue re-pacing. In the 110k-invite data, Open Profile people accepted 26% vs 14% and showed interest 2.4x as often.
- **Launch check** (`src/lib/campaigns/launchCheck.ts`). The campaign editor shows a "Before you launch" panel.
  - **Blockers stop "On":** placeholders nothing fills in (`{{market_observation}}`, `{{type_of_owner}}`, unknown tokens), a greeting glued to the name ("Hi{{first_name}}"), and connection notes over 300 characters.
  - **Warnings:** a link in the connection note, "Free Coaching Discovery Call", fake scarcity, "jaded by all the other coaches", "just checking you saw my last message", messages over 700 characters, "as I mentioned in my connection message" after a blank invite, "a {{company}} business", and audiences that are 30%+ trades, 40%+ titled just "Owner", or 30%+ US for a UK coach.
- **Safety net in the sender:** the worker now refuses to send a step that still has an unfilled placeholder, and records why on the job instead of sending a blank.

**Found tonight, needs you:** BCA's published library templates "Connection" and "Reactivation" (in the database, step 3) contain `{{type_of_owner}}` and `{{market_observation}}`, and nothing in the app fills them in. 16 coach campaigns copied them. **Three are running, all Adam Westbrook's:** "Cheshire Trades 24th Sept 2026", "Fisrt 250 - Connector 28.09.26" and "Boss Scorecard - How are you REALLY performing". No message with the blank has gone out yet. Until this branch is live, the live app would send "I work with , so I hear the same thing a lot." once those leads reach that step. Edit those steps (or pause the campaigns) in the morning, and change the two library templates so the placeholders read as obvious fill-ins.

## Decisions I made (overturn any of these)
- Only things prospects would see broken block a launch. Everything else is a warning with the reason from our data.
- Audience warnings use the first 300 people in the campaign.
