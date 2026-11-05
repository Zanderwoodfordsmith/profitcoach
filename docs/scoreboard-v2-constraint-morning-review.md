# Scoreboard V2 and Ava's plan and constraint skill: morning review (5 Nov 2026)

> **Update, later on 5 Nov:** after Zander tried it, V2 no longer starts from real data. Too few call steps are tracked, so most rows were targets and the mix confused ("we've jumped ahead too much"). V2 now starts from the clean example (400 outbound, the KPI rates, £12k) and coaches type their own numbers over it. Kept: add a lead source, pace in months, plus a new cap at 20 clients at once (Great had shown £96k from 48 clients; now £40k with "you'd be full in about 5 months"). Real data stays with Ava. Tracking the call steps is job 198 (Ideas). The sections below describe the first version; where they disagree, this note wins.

Jobs: 182 (Scoreboard) and 143 (Ava: a constraint skill). Nothing is committed: everything is in the working tree on main, as usual for your 3002 review.

## Where to look

- **Scoreboard V2:** http://localhost:3002/admin/scoreboard (V2 is the default; the **V1 | V2** switch is in the top bar, left of search). Add `?coach=<coach id>` to see a coach's own board.
- **Ava:** open Ava as admin on a coach and ask "what's holding them back?" or "they want £15k a month, what's the plan?".
- **Transcripts:** Drive, AI Brain: Alex Hormozi Content / 100M Virtual Implementation Workshop (8 files).

## What's built

**Scoreboard V2** (beside V1, which is untouched):
- Starts from the coach's own numbers: LinkedIn invites and interested (30 days), Constraint Calls and roadmap calls from the calendar and app bookings (30 and 90 days), new clients from the client list, the average fee from the client list (or the Blueprint price), and website, BOSS Score and booking-page leads as inbound.
- Every row says **Your data** or **Target for now**, and why on hover ("Too early to judge: 106 invites in 30 days, and it needs 300").
- **Add a lead source**: name it, its target, its rate now and people a month (referrals, a partner, an association). It adds to Interested like outbound and inbound. Saved on the device, up to 8.
- Pace reads "a new client every 2.4 months", with weeks only up to 8 weeks.

**Ava's skill** (now "Plan and constraint"):
- Every chat, the coach card carries a short block: their last 30 days, their signing pace, the ceiling they top out at, the likely constraint (marketing or sales, volume or rate) and any rate below Good. She is told to keep it in view and to say once a chat when what they're working on won't move it.
- The tool works out the plan: ceiling = new clients a month × months kept × fee, how long to the goal, what each number would need on its own, and the work-back to people a month at their rates, at Good and at Great.
- The skill walks the order from the workshop (more, numbers, market, model, rates, time), adapted for one-person practices. When it's volume, she uses a new lead sources sheet: warm, cold, content, ads, referrals and partners (no staff, agencies or affiliate schemes).
- "Can I show you?": in admin chats she links the coach's V2 board. Coaches get the link only once the Scoreboard is released.

## Decisions I made (overturn any of these)

1. **No branch, no commit.** Your working tree has a lot of other uncommitted work (including Scoreboard V1 itself, which isn't committed yet), and other sessions share it. Switching branches would have moved all of it. V2 is all new files, plus small additions to the top bar, the coach card, the constraint tool, Ava's router and the Scoreboard page.
2. **Kept your Scoreboard defaults** (400 outbound, 1%, £2,000, 12 months: £12k a month, one client every 2 months). The "2 a quarter" idea is dropped.
3. **Show rates and months kept stay at target.** The calendar marks every call "booked" and never records a no-show, and clients have no end date. Both say so on the row.
4. **Constraint Call vs roadmap** is told apart by a calendar name with "roadmap" in it. Coaches without one get the target for "Constraint Call to roadmap", and their close rate is worked out from all calls.
5. **Inbound** counts only leads tagged as website, BOSS Score or booking page. Referrals aren't tracked anywhere, so the row tells them to type theirs or add a lead source. Content (posts) can't be tied to leads yet, so it isn't counted.
6. **Added lead sources save on the device**, like V1's numbers, not in the database. Saving across devices needs a table, so I left it.
7. **Fee falls back to £2,000** when there's no price anywhere, and Ava says it's assumed.
8. **The coach card numbers are cached 10 minutes per coach.** The lookup takes 1 to 3 seconds, too slow for every message.
9. **One skill, not two.** The plan and the constraint use the same sums. The diagnosis is the gap between the plan and their numbers.
10. **V2 is the default** on the Scoreboard page. Only admins can see the page, and V1 is one click away.

## I checked

- Typecheck passes. Lint passes on every file I touched.
- Tests: 36 agent tests pass, including your example (one client every 3 months, 12 months, £2,000 → 4 clients, £8,000) and the work-back (£10k: one client every 2.4 months, 420 outbound at Good, 60 at Great). 6 Scoreboard V2 tests pass, including V2 matching V1 exactly when nothing is added (£12k).
- The V2 API as Zander Demo: 200 in about 0.8 seconds, the right "data" or "target" for each number, and 401 without a login.
- The loader on Mark Hodgkinson, Pam Woodford and Rolando Vilarreal: real invites (106, 412, 189), Pam's 0 interested from 412 shows as 0% from her data, and inbound leads come through (1, 7, 0).
- V2 opened in a browser as Zander Demo (told it was an admin in that browser only), at 1500 wide: switch shows, all rows labelled, adding "Referrals" adds a row and moves Interested. The only console errors are admin-only requests refused for the demo login. V1 still opens and looks as before.

## You check

- The V2 board with your admin login, on a coach with real activity (`?coach=` one of the three above).
- At 1500 wide the table scrolls a little on the right once the Diff and If hit columns have numbers. Fine, or should those columns tighten?
- The words "Your data" and "Target for now" under each row.
- A live Ava chat. I didn't run one (each costs a little, and overnight builds don't spend). The coach card text and the tool output are checked; how she uses them isn't.
- Ava's tone when she flags the constraint behind the scenes. Ask her something unrelated (the bio) on a coach with few invites.
- Pam: 0 accepted from 410 invites in the last 30 days. That looks like a data problem, not her real result. I didn't dig into it.

## Not done

- Releasing the Scoreboard to coaches: your call ("release Scoreboard").
- Show rates and months kept from real data: needs no-shows recorded and client end dates.
- Saving added lead sources across devices.
