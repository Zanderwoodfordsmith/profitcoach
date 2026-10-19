# Overnight build: Ava replies, lead quality, group tests, coach health (17 to 18 Oct 2026)

> **Read this first.** The new coach health board (Admin, Coaches, **Get clients**) shows that in the last 30 days only **one** active coach (Mark Hodgkinson) sent invites through Get Clients, and **14 of 34** active coaches haven't connected LinkedIn to the app. Everyone else still runs on Sales Robot. Everything below (Ava alerts and autopilot, launch checks, active-first ordering, group tests) only works on Get Clients campaigns, so **moving coaches from Sales Robot to Get Clients is now the biggest lever.** Suggested next step: a "switch-over week" where BCA connects each coach's LinkedIn and rebuilds their best campaign in Get Clients with them.

> **Also read this.** The app is now much faster (section 7), and the single biggest speed win only lands when this branch is deployed: `vercel.json` now runs our server functions in **London**, next to the database. Until now they ran in Washington DC, so every database query crossed the Atlantic. Two things changed behaviour you should know about: sign-in tokens are now checked locally (a signed-out session keeps working for up to an hour, see 7.2), and six old migrations that had never reached the live database are now applied (7.5).

Branch: `ava-copilot` in a separate worktree (`../profit-coach-app-ava`). Nothing pushed. Database changes are all additive (new tables and columns only): the ones this work needed, plus six older migrations from the repo that had never been applied (listed in 7.5).

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
4. Coaches need a mobile number for WhatsApp alerts. There was nowhere to set one, so the Ava card on Today now has a "Your mobile" field (it saves to their profile).
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

## 3. BCA group tests

**What it is:** Admin, Campaign library, **Group tests** tab. A test is one step (the first message after connecting, or the connection note) with two fixed versions, A and B. Coaches join from their campaign editor ("Join a BCA group test"). They fill in only their own slots, for example who they help and what those owners say most, then preview both versions. The step is then locked: the editor shows it read-only, and the server restores the wording if anything tries to change it. Each person gets A or B at random, and results pool across every coach in the test.

**Results** show people, accepted, replied and interested per version, how many coaches are in, and a plain-English verdict. It only calls a winner when the gap is unlikely to be luck (p < 0.05, 200+ people per version); otherwise it says how far it is from the target (default 1,500 per version).

**New merge field `{{profile_hook}}`:** one true sentence Ava writes from the prospect's LinkedIn profile when the message sends. Example from a test profile: "You've taken Hallmark Precision Engineering from 12 staff to 46 since taking over from your father in 2011, which is no small feat." If the profile is thin, it falls back to "I see you're running {company}." It is cached on the lead, and any coach can use it in any message.

**Seeded as drafts (not live):**
1. "Who you are: tribe or place". A names their tribe ("I work with [[tribe]]"), B names their area ("owners around {{city}}"). Same pain line and question.
2. "A line from their profile". A tribe callout vs B profile line plus tribe callout.

Tested live on a Zander Demo draft campaign (join, lock, results, leave, then restored exactly).

## Decisions I made (overturn any of these)
- Two versions per test, not three. The existing A/B system only handles two, and two need half the people of three to reach an answer. Your three ideas became two tests.
- The test replaces the first message step (or the connection note), so coaches don't have to rebuild their sequence.
- Leaving a test keeps version A as the coach's own wording.
- Win rule: p < 0.05 and at least 200 people per version. Target 1,500 per version (adjustable per test).

## 4. Industry tiers and coach profiles (report + app)

- The report has a new **Industries and profiles** tab: https://claude.ai/artifact/H36bnhh1RuFdvCyBYeGeSH
- **LinkedIn score by sector** (per prospect, from company name and job title):
  - **7 to 9:** consulting and professional services 9; IT, software and tech 8; recruitment, accountancy and finance, property, education, marketing 7.
  - **4:** construction, engineering and manufacturing, trades, logistics, hospitality, automotive.
  - **3:** health and care.
- The same scores now live in the app (`src/lib/campaigns/sectorTiers.ts`). The launch check warns when 35%+ of a campaign's people are in a sector scoring 4 or below.
- **Coach profiles:** a full About section (1,200+ characters) and 1,000+ connections go with 4 to 6 points more acceptance. Headline wording showed no clear effect. Only 37 coaches, so treat this as a signal, not proof.

## 5. Coach health board

Admin, Coaches, new **Get clients** tab. One row per active coach:
- **Columns:** invites (7 and 30 days), acceptance, replies, interested, calls booked (GHL first calls plus our own calendar), median reply time, last time in the app, LinkedIn and Blueprint state.
- **Status:** red, amber or green, with the one thing to **fix first** and a suggested next step.

The rules run in order (`src/lib/coachHealth.ts`, tested): not logging in for 14+ days, LinkedIn not connected or broken, not sending, Blueprint unfinished, under 200 invites a month, under 10% acceptance, interest but no calls, replies slower than 4 hours. Sales Robot coaches aren't marked stuck for not sending through Get Clients.

Today's board: 14 "LinkedIn not connected", 6 "not logging in", 5 "not sending", 1 broken connection, 8 "Blueprint not finished".

Ava's daily nudges (from the Ava plan) can read this board directly. It takes about 15 seconds to build, so it's admin-only and on demand for now.

## 6. Client data prep (for next week's entry)

So coaches can enter their clients in one go and we learn what their best clients look like.

**What a coach sees.** On their Clients page:
- An **Add many** button. They copy their client list from Excel or Google Sheets (header row included) and paste it in. Only Name is required. A button copies the column headings so they can start a sheet in the right shape. Rows that fail say which sheet row and why; the rest still save.
- A **Your best clients** card. It weights clients they rate 4 or 5 double and shows sector, turnover, team size and how clients found them, plus a one-line summary, for example "Your best clients are mostly £1m to £2m turnover accountancy businesses with 6 to 15 staff, and most found you through referral."

**New client fields:** sector, turnover band, team size, how they found you, the result you got, and fit (1 to 5: "how many more like them would you want?"). These go alongside the fee and dates the roster already had.

**Forgiving input.** Turnover can be typed as "£1m-£3m", "750k", "1,200,000" or "2.5". We take the midpoint and pick the band. Team size works the same way ("10-24", "about 30"). Source understands everyday wording ("referred by Sam" becomes Referral, "saw my LinkedIn posts" becomes LinkedIn posts), and anything it can't place becomes Other rather than failing.

**For you.** Admin, Coaches, Get clients now has a **Coaches' clients across BCA** panel above the board. It shows how clients found their coach, sectors, turnover and team size across every coach, and how many clients are in sectors that rarely answer on LinkedIn. It stays hidden until clients have been entered.

**Tested:** unit tests, plus a live run on Zander Demo that pasted two clients, saved them, read them back and deleted them.

## Decisions I made (overturn any of these)
- Turnover bands: under £500k, £500k to £1m, £1m to £2m, £2m to £5m, £5m to £10m, £10m+. Team bands: 1 to 5, 6 to 15, 16 to 50, 51 to 200, 200+.
- At most 300 rows per paste. A row whose LinkedIn URL is already a prospect is refused with a message to convert them from Prospects, the same as the single form.
- Fit is optional. Without it every client counts equally.

## 7. Speed: the whole app

I measured the 13 busiest coach pages (from 30 days of usage: Community, Campaigns, Calendar, Classroom, Playbooks, BOSS Pro, Support, Conversations, Prospects, Settings, Blueprint, Today, Clients) in a production build, signed in as Zander Demo, before and after.

| Page | Before | After |
|---|---|---|
| Campaigns | 16.4s | 3.6s |
| Conversations | 14.6s | 8.1s (list shows at about 2s) |
| Today | 11.8s | 3.5s |
| Community | 7.2s | 3.7s |
| Settings | 4.4s | 2.2s |
| Playbooks | 3.7s | 1.9s |
| Support | 3.6s | 1.6s |
| Classroom | 3.2s | 1.5s |
| BOSS Pro | 2.5s | 1.4s |

Time until the page stops loading data. Measured from here, where every database call takes about 200ms, so live numbers will be lower still once the London change is deployed. JavaScript per page is down 135 to 270KB (compressed) and API calls per page are down about a third.

### 7.1 Server region (needs a deploy)
`vercel.json` now has `"regions": ["lhr1"]`. Live response headers showed our functions in Washington (`iad1`) and the database in London (`eu-west-2`). Every query paid about 75ms each way, and most API calls make several queries in a row, so this should cut several hundred milliseconds from most of them. Its own commit, easy to revert.

### 7.2 Sign-in checks (behaviour change)
Every API call used to ask Supabase Auth "is this token valid?" over the network. Tokens are signed with the project's ES256 key, so they're now checked locally against the public key (`src/lib/auth/verifyAccessToken.ts`, used by all 40 places that checked tokens). Roles are still read fresh from the database on every call. **Trade-off:** if someone signs out on one device, a token already issued keeps working until it expires (at most an hour). That's Supabase's own recommended approach. Revert that one commit if you'd rather keep the network check.

### 7.3 Less repeated work on every page
- The sidebar, top bar, route guard and pages used to load the same profile, role and coach access 3 to 8 times per page. They now share one request, and the next page paints from the last answer while refreshing.
- The browser read the signed-in user with a network call in 61 files. It now reads the local session (the server still checks every request).
- The notification bell loaded twice per page and reloaded everything on every page change. It now keeps what it loaded, pauses in hidden tabs, and only writes read-state back when something changed.
- The campaigns page paged through every pending LinkedIn invite (about 12 seconds) on every visit, just to show a count. The count is now stored and refreshed in the background.
- Today waited on a live LinkedIn scan. It now shows straight away and scans afterwards, at most every 15 minutes unless the coach presses "Check again".
- Messaging checked auth twice for coaches, programme status re-ran on every access check, and several endpoints ran independent queries one after another. All of these now run once or together. The admin coach list's seven per-coach lookups run together; lesson content for 13 courses went from 2.4s to 0.2s.
- The Blueprint assistant panel and the Get Clients warmups no longer load twice; Settings shows before the LinkedIn import check finishes; the inbox no longer runs cron jobs from the browser (Vercel runs them every minute anyway).

### 7.4 Smaller downloads
- One menu import pulled Node's crypto library (about 120KB compressed) and the server-only Supabase admin client into **every page**. Fixed, and a new test (`src/lib/clientBundleGuard.test.ts`) fails the build checks if any browser code can reach either again.
- The notification bell was importing the whole Community feed, so every page carried it. Now loaded only when needed.
- The AI panel, the Blueprint assistant and the ElevenLabs voice SDK load only when opened.

### 7.5 Database fixes found on the way
A check of every migration against the live database found six that had never been applied, which I applied:
- `community_post_favourites` table: starring posts never worked.
- Community feed indexes. The migration failed as a whole because it also referenced the missing favourites table.
- `client_playbook_unlocks.status`: unlocking playbooks for clients failed on save. The table was empty, so there was no data to change.
- `profiles.scorecard_period_start_monday`: the scorecard API asked for a column that didn't exist.
- `coach_action_items.contact_id` plus an index.
- `academy_import_overrides` table, for the admin academy import.
New tonight: `linkedin_outreach_accounts.pending_invites_*` (stored invite count) and `intent_signals_refreshed_at`. One migration is still unapplied on purpose (`sales_nav_import_session`): nothing uses it.

### 7.6 Not done, for later
- Admin pages (60% of sessions) weren't browser-tested: there's no test admin account and I didn't sign in as a real admin. They share most components and APIs with the coach pages, so they get most of the gains. Worth creating a test admin so this can be measured too.
- Admin Support loads every ticket (99 today, fine). It will need paging when there are thousands.
- `/api/profile-role` answers without sign-in: anyone with a user id can get that person's role, name, business name and coach slug. Login depends on it, so I didn't change it tonight. Suggest a security pass (ask me to run Rafter on it).

## 8. UX audit (13 busiest coach pages, desktop and phone)

Screenshots at 1440px and 390px, plus automated accessibility checks (axe, WCAG A and AA).

**Fixed**
- Community sidebar said "0 members, 0 online, 0 admins" and "No recent activity" for the first 8 seconds of every visit. It now fills in within about a second and shows a dash until then.
- On phones, the sidebar toggle sat on top of every page title ("Get Clients" read "et Clients"). Titles now clear it, and the small (i) next to the title is hidden on phones to give the title room.
- The campaign activity chart's quarter view printed 14 overlapping dates. It now labels every other week (every fourth on phones), and always this week.
- Today opened with Ava's settings card. It's now a one-line summary ("Ava replies: Copilot, alerts by this device, WhatsApp") with Change. Autopilot's locked label read "switched on by BCA" while it was off; now "BCA turns this on when you're ready".
- Client data prep: the client editor now has sector, turnover, team size, how they found you, result and fit, not just the paste import.
- Accessibility: all critical issues gone. Post cards and inbox rows no longer put buttons inside buttons (122 to 6). The BOSS Score "Who are you scoring?" picker now works properly with screen readers. Chart bars, online dots and the avatar upload have proper labels.
- Settings, Reply style: rewritten without jargon or an em dash ("Optional notes for the replies Ava drafts for you: how you sign off, what you never pitch, phrases you like.").

**Your call**
- **Contrast:** 242 bits of light grey text (`text-slate-400`) fail the WCAG contrast minimum on 9 of the 13 pages: dates, meta lines, placeholders. Moving secondary text to `slate-500` passes but makes the UI a touch heavier. It's a design decision, so I left it.
- **Em dashes in the UI:** 411 in app and marketing copy against the writing rules. The most are in `admin/brand`, `HorizontalLeadFlowMap`, `how-it-works`, `new-home`, `pam`, and `StepAvatar` (first campaign). Each needs a human rewrite rather than find-and-replace. Some are on live marketing pages, so I didn't touch them.
- The BOSS Score picker's dropdown hangs below its card. It works, but the card could grow with it.
- On phones, Conversations opens straight into the first thread instead of the list.

**Note for checking locally:** some fixes use new Tailwind classes (`max-md:pl-7`, `max-sm:hidden`, `max-sm:invisible`). If they look missing on 3002, clear `.next/dev` first (the stale Tailwind cache issue).

