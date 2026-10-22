# Overnight 22 Oct: morning review

Branch `overnight-2026-10-22`, one commit per job. 3002 is running this branch. Your other session's uncommitted files (Blueprint backfill script, usage route change, support migration) are untouched and not in any commit.

## In Review (7 cards, each has "Where to look" and "What to check")

| Job | What changed | Your check |
|---|---|---|
| #64 Lesson pages need a login | Classroom and Vault lesson pages send titles only. Video, text and transcript load from a new API that checks the login and the member's plan. | Open a lesson in a private window: login page. Signed in: plays as before. |
| #68 Create hub AI loads only what it needs | Each skill lists its brand files; the router's tables come from code; the 39KB feedback CSV became a short lessons file. Prompts are 17 to 70% smaller. | Read `docs/overnight-2026-10-22-create-hub-before-after.md`. |
| #7 Booking alerts | Coaches get a "New call booked" email (and a push if alerts are on) when a prospect books. | Two test emails in the Zander Demo inbox. Read the wording. |
| #12 Profile Optimizer for BCA | Admin "Write all three" button: headline, About and banner from the Blueprint in one go. | Press it on /admin/linkedin-profile as Zander Demo. Untested in a browser (no test admin login). |
| #72 Link a lesson, chapter or time | Nothing built: it already shipped yesterday. Tested only. | Try the Lesson button in a post and a comment. |
| #65 Hidden lessons behave | Old links to hidden lessons land on the course; the rail and Classroom cards skip hidden lessons from the first paint. | Open the hidden lesson link on the card. |
| #70 Ava capability files, same shape | All 18 have an Inputs section and one "What NOT to do" heading. | Ask Ava 3 things; I didn't run live Ava (real tools, real data). |

The three Classroom cards (#64, #65 and #72) share a place to look, so check them together.

## Not ready (questions written at the top of each card)

- **#45 Link bookings to campaign leads:** four questions only you can answer (day 1 for "days to first call", OK to match by name, booking links in campaign messages, what counts as a first client). Back in Up next.
- **#10 Ava nudges:** about a week of work; a split into four jobs is on the card.
- **#74 Polls upgrades:** suggested a testable Done when and a v1.
- **#23 Directory, #39 BOSS Score Review offer, #56 Explainer brochure:** yours (design answers, tomorrow's talk with Pam, and a review).
- **Every other To do card** now has a "Not ready tonight" line saying what it needs: your decision, tomorrow's BOSS Score Review talk, a split (#9 Onboarding, #49 Ava skills), or a real coach, client, lawyer or phone. That's the list for tonight's prep hour.

## New cards in Evaluate

- **#77 Weekly focus, Resources and Compass need a login.** Same problem as #64 on three more pages: the Resources library, with its Google Sheet links, goes out to anyone.
- **#78 Lesson videos: private storage with signed links.** The video files are in a public storage bucket, so anyone holding a link can watch, even after #64.

## Decisions I made (overturn any of these)

1. **#64 login check is in the browser, not the server.** Logins live in the browser (no cookies), so the server can't see who's asking. The page now carries no content, and the content API checks the login. A server-side redirect would mean moving logins to cookies: a bigger change.
2. **#64 also enforces the paid plan on the server.** A coach whose plan doesn't include a programme now gets no content from the API (before, the page blurred it but still sent it). Admins browsing as themselves see everything; "view as" follows the coach's plan.
3. **#68 brand files per skill.** Every skill: writing rules and brand voice. ICP everywhere except Coaching AI. Avatar file for ideal client, avatar, profile, connector, nurture, newsletter and posts. Copywriter file for profile, connector, nurture, newsletter and posts. Methodology for profile, nurture, planning, newsletter, posts, funnel and Coaching AI. Offer stack for nurture, planning and funnel. Business profile for the LinkedIn profile only. Skills without the offer stack are told never to state a price that isn't in their files.
4. **#68 the connector CSV stays in the repo but leaves the prompt.** Its lessons are summarised in `src/knowledge/connector-message-lessons.md`, editable in Core brain. No coach or client names in it.
5. **#7 the alert fires only when a prospect books through the public page**, not when a coach books a call themselves from the app.
6. **#7 the email always sends** (it doesn't follow Ava's email alert setting). It comes from the coach's own mailbox, or from BCA support if they haven't connected one.
7. **#7 I left BCA's own pages on GoHighLevel** (/zander Fit Call, support call, advisory Blueprint). They feed your own pipeline, so switching them is your call. New coaches were already on native booking.
8. **#12 admins skip the 5-second rewrite cooldown** so the three sections write at once.
9. **#45 I didn't build it.** With no exact links and no join dates, the numbers would mislead.
10. **#65 the admin Classroom cards still count hidden lessons**; only the coach cards skip them.

## Things to know

- **The Mac went to sleep on battery** from about midnight to 04:40, so the night was shorter than it looked. I kept it awake until about 06:15 with `caffeinate`. For future nights: plug in before bed, or I'll start `caffeinate` as part of the prep hour.
- **Test data:** one booking on Zander Demo's Discovery calendar (Fri 23 Oct 16:45), already cancelled. Two alert emails and one confirmation email went to the Zander Demo inbox. Six AI calls for the before/after test (pennies).
- **Lint:** two lint errors in files I touched were already there before tonight (`CoreBrainSkillsTab.tsx` line 398, `ProfileOptimizerPage.tsx` line 90). I didn't fix them.

## To ship

When you're happy with the cards: `git checkout main && git merge overnight-2026-10-22` (it fast-forwards), then `;stage`. To drop one job, `git revert <commit>` for that job before staging.
