# Overnight 22 to 23 Oct: morning review

Branch `overnight-2026-10-23`, one commit per job. 3002 runs this branch. Another session's uncommitted change (`src/lib/directoryPage/types.ts`) is untouched and in no commit.

Each card in Review has "Where to look", "I checked" and "You check" at the top of its notes. Below is the short version.

## In Review

| Job | What changed | Your check |
|---|---|---|
| #45 Link bookings to leads | Bookings link to the campaign lead (personal link, contact or name). `{{booking_link}}` in campaign messages and Ava's time offers. Coach health: First call and First client columns. | The two new columns on Coach health. |
| #10 + #105 Ava nudges: scan and queue | Daily scan queues a drafted nudge per stuck coach (26 tonight). Admin → Ava → Nudges to approve, edit, reject. | Open the queue, approve one, read the nine templates. |
| #107 Nudges post to Blueprint threads | An approved nudge posts as Ava into the right section thread. | Test nudge on Zander Demo's Campaigns page. |
| #106 Nudge guardrails | Snooze (coach in Settings, or admin in the queue), quiet hours, one a day. | The "Ava's nudges" row wording. |
| #104 Ava "Check it together" | Tried end to end. Fixed: Your tone couldn't be signed off until "Keep this" was pressed. | Nothing (Zander Demo's tone and "known" are now signed off). |
| #103 Blueprint phone pass | All 10 pages at 390 and 1440. Fixed four phone problems. | A glance on your phone. |
| #108 Digital explainer | `/site/{slug}/explainer/digital`, two versions (before the BOSS Score Review, before the Profit Roadmap call), side menu, Save as PDF prints the matching A4. | The look and the new "plan" lines; the review version has no price. |
| #109 Proposals | Get Clients → Proposals (admin-only). From the Blueprint, edit any section, private link. | The editor and the prospect view. |
| #110 Send and track | Email from the coach's own mailbox, or copy the link. Opens counted, push on the first. | Send one to yourself for real. |
| #111 Sign online | Full name and a tick; the words they saw are kept; it locks; both sides get a copy. | Look for the "Signed:" email in the Zander Demo inbox. |
| #57 Welcome packs | Same engine. Keep Clients → Welcome packs, or from a signed proposal. AI welcome note in the coach's voice. | The starting words and the look. |

| #101 Tagged links | Toolkit → Links: tag a link (LinkedIn, YouTube, QR…). BOSS Scores and opt-ins remember it; prospects show "via LinkedIn"; admin sees BOSS Scores by source; QR codes are tagged. | The admin "Where BOSS Scores came from" panel. |
| #100 Content Settings | It crashed for coaches on Unipile, and Save stored nothing for them. Fixed both. | The same as admin on /admin/linkedin?tab=settings. |
| #102 Newsletter list | Newsletters as list rows, with a List / Cards switch. | The look. |
| #99 Instagram "too many attempts" | Instagram's own block after repeated tries. A failed connect now says what to do (and the message no longer vanishes); a tip before connecting. | The wording; whether to ask Unipile about Paul. |
| #77 Login for Weekly focus, Resources, Compass | Pages send titles only; content loads after sign-in. The Resource Library no longer ships every sheet and file id to browsers. Checked on a production build. | Click through Resources as yourself. |

The proposal jobs (#109, #110, #111, #57) share one place to look: check them together.

## Not built

- **#78 Lesson videos: private storage.** Reached 06:15 while scoping. The bucket is 26 GB (a copy would double the cost) and is shared with live, so flipping it private early would stop every lesson video. The plan and one question are on the card.
- **#2 Blueprint done-for-you sections** (In progress): the list you asked for is on the card. Only 4 of 21 BCA sections fill from About You alone; the rest also need the Ideal Client and Offer pages. Question on the card: who fills those?
- **Still in Up next, not reached:** #84 cold email campaign, #86 owner nurture emails, #87 client page, #93 Profit levers phone table, #74 polls, #25 notifications, #26 chat with BCA, #49 Ava answers from the lesson, #69 brand canon, #37 lesson rename. They're ready for tonight.

## Decisions I made (overturn any of these)

1. **#45 day 1** is the Stripe subscription start; coaches who pay another way use their first payment. Coaches with neither show "–" rather than the 4 May import date.
2. **#45 name matching** refuses two different people with the same name (4 bookings). 105 of 338 GoHighLevel bookings linked by name.
3. **#10 one waiting nudge per coach.** A coach still stuck at the same point keeps the waiting one; moving on drops it.
4. **#106 pausing nudges drops waiting and approved ones** rather than holding them, so nothing stale arrives later.
5. **#107 nudges post only into the Blueprint thread**, no email or WhatsApp yet.
6. **#108 no price in the BOSS Score Review version.** The "top coaches' clients invest £30,000+" line needs a number you're happy to print (PRODUCT.md says no published prices yet).
7. **#109 proposal terms start empty.** I didn't write legal terms; the coach pastes their agreement (BCA's template still needs the lawyer, job 58).
8. **#110 proposals email only from the coach's own mailbox**, never from BCA support.
9. **#111 signing stays admin-only** with the rest of Proposals until the agreement is lawyer-checked.
10. **#57 welcome packs share the proposal engine** (one table with a kind, one editor).
11. **#101 tags:** standard utm tags plus a short `?src=`. The browser keeps the latest tagged visit for 30 days; the contact keeps the first source ever seen. Tags in emails not done.
12. **#99 no retry block** in our app; the fix is telling coaches to stop, approve in the Instagram app, and wait.
13. **#77 login only** for Resources and Weekly focus (no plan check, as before); Compass uses the Classroom's plan check. After editing `content/resources/library.json`, run `npx tsx scripts/build-resources-public.ts` (a test fails if you forget).
14. **#102 List is the default** newsletter view; Cards stays one click away.

## Things to know

- **The session restarted at about 21:55.** I restarted caffeinate and the 3002 dev server; nothing was lost.
- **Test data on Zander Demo:** a cancelled Discovery booking (#45); Ava nudges and one posted nudge in the Campaigns thread (#107); two proposals ("Hartley HVAC Ltd" unsigned, "Signing Test Ltd (job 111)" signed) and one welcome pack; Your tone and How you want to be known signed off (#104); Ava's nudges paused then turned back on (#106).
- **Migrations applied** (all additive): booking lead links, ava_nudges, nudge snooze, coach_proposals, coach_proposals kind, traffic source, linkedin_composer_settings.
- **More test data on Zander Demo:** a BOSS Score and prospect "Traffic Test" (Tag Test Ltd) for #101.
- **Old lint errors** sit in files I touched (BOSS Score pages, Settings integrations, Compass player, Blueprint section view). I checked each: same count before and after, none mine.

## To ship

When you're happy with the cards: `git checkout main && git merge overnight-2026-10-23` (it fast-forwards), then `;stage`. To drop one job, `git revert <commit>` for that job before staging (each job is its own commit).
- **AI spend:** a handful of Claude calls for Ava's test conversations and one welcome note (pennies).
