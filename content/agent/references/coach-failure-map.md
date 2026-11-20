# Coach failure map

**Draft, 20 Nov 2026. Zander to review. No Ava capability loads this yet.**

Every way a coach can fail to get and keep clients, in Scoreboard order. Each line has a fix.

- **[data]** = the app or Ava could spot it from data.
- **[ask]** = someone has to ask the coach.

Built from the Profit Coach Scoreboard sheet (Scoreboard and Fix The Constraint tabs), the app Scoreboard (src/lib/scoreboard.ts) and outreach-research.md. The sheet's "Value Session" is the Constraint Call here, and "Follow-Up Call" is the Profit Roadmap call.

## 0. Never gets started (before any outreach)

- **Doesn't know who they help**
  - No niche picked, or "any business owner". [data: Blueprint About You empty] Fix: finish the Blueprint niche step with Ava.
  - Niche too small to fill a list, or not on LinkedIn (trades, care, construction). [data] Fix: an owner-led £1M+ niche that uses LinkedIn, or a different channel for that niche.
  - Niche they have no story or proof in. [ask] Fix: choose where their past career gives them credibility.
- **No offer to point people at**
  - Can't say in one line what the Constraint Call gives the owner. [ask] Fix: Scripts price line and Constraint Call wording.
  - Leads with "coaching" or "a programme" instead of a clear result. [data: notes and messages] Fix: sell the call, not the coaching.
- **Profile isn't ready**
  - Headline confusing, or "business coach" with no outcome. [data] Fix: avatar plus outcome, e.g. "I help £1-20M owner-led businesses…"
  - Banner looks like a life coach, or no banner. [data] Fix: Profit Coach banner template.
  - About thin (under 1,200 characters), vague, or about them, not the owner. [data] Fix: name the owner, their pains, the result, how they work, invite to the call. Full About plus 1,000+ connections adds about 4-6 points of acceptance.
  - Featured section proves nothing. [data] Fix: 2-4 items: Profit System explainer, a case snippet, a call explainer.
  - Under 1,000 connections, so they look new. [data]
- **No time set aside**
  - No outreach block in the week, outreach done "when there's time". [ask, or Power Plan] Fix: fixed daily blocks in the Power Plan.
  - Still in a full-time job, or client delivery fills the week. [ask] Fix: a realistic daily target for the time they have.
- **Head stuff**
  - Afraid of looking salesy, so never presses send. [ask; signal: set up but nothing sent] Fix: start with the softest note (blank invite), practise in a simulator.
  - Waits until everything is "perfect". [data: weeks of edits, no sends] Fix: launch on "good enough" with a date.
  - Doesn't believe the numbers will work for them. [ask] Fix: Scoreboard example, pace in months, one peer story.

## 1. Volume: not enough people reached

*Scoreboard: Outbound a month, Inbound a month. Sheet: Connection requests, Other outreach.*

- **Can't find the right people**
  - Doesn't know how to use Sales Navigator or search filters. [ask] Fix: saved search template, or BCA builds the list.
  - Filters too loose: non-owners, tiny solos, other coaches, students, wrong region. [data: list sample] Fix: Owner/MD/CEO, 10-50 staff, £1-20M, target region.
  - Filters too tight, list runs dry in a week. [data: list size] Fix: widen the region or add a second sector.
  - List full of dead accounts (no activity in years). [data] Fix: favour active profiles. They accept at 26% vs 14% and give twice the interest.
  - Can't find emails or numbers for email or phone outreach. [ask] Fix: enrichment tool, or BCA does it.
- **List never loaded**
  - Search built but never put into the sending tool. [data: campaign has 0 leads] Fix: Ava nudge "Your list is ready but not loaded."
  - Loaded once, never topped up, campaign ran out. [data: queue empty] Fix: weekly top-up reminder.
- **Sending never set up**
  - No sending tool connected (LinkedIn tool, email inbox). [data: no connection] Fix: connect gate, BCA sets it up.
  - Campaign made but not started (draft or paused). [data] Fix: Ava flags campaigns that haven't sent for 3+ days.
  - Message steps empty or still placeholder text. [data]
  - Daily limits too low (e.g. 5 a day). [data] Fix: 20-40 requests a day, 5 days a week.
- **Set up, but not delivered**
  - LinkedIn account restricted, or logged out of the tool. [data: tool status] Fix: reconnect, slow down, warm the account.
  - Hit LinkedIn's weekly invite limit, sends stall. [data] Fix: withdraw old pending invites, spread sends across the week.
  - Tool paused itself (card failed, subscription ended, session expired). [data]
  - Email: domain not warmed up, no SPF, DKIM or DMARC, goes to spam. [data: bounce and spam rates] Fix: warm up, separate sending domain.
  - Email: bad addresses, high bounces. [data] Fix: verify the list before sending.
  - Merge field broken ("HeyThomas," or "Hi {first_name}"). [data: sent text] Fix: preview check before launch.
  - Sending in the wrong time zone, or at weekends. [data]
- **Delivered, but not seen**
  - Person barely uses LinkedIn. [data: quiet profile] Fix: switch channel for that person: email, phone, letter.
  - Message lands in "Other" or a requests folder they never open. Fix: connect first, then message.
  - Email lands in Promotions or a shared inbox a PA filters. Fix: plain-text email, no links in email one.
  - Only ever tried one channel. [data] Fix: a second touch on another channel for the best-fit people.
- **Volume too low or patchy**
  - Sends in bursts, then nothing for weeks. [data: daily sends] Fix: daily target, kept up for 4 weeks before judging.
  - Stops after 2 weeks because "it's not working", before there's enough data. [data] Fix: Scoreboard pace. At 1 in 100, 400 a month is about 4 interested.
  - Too much time on content or tweaks, not enough sending. [ask]
- **Inbound volume low**
  - Never posts, or posts about themselves, not the owner's problems. [data: LinkedIn history] Fix: Ava post drafts from the Blueprint.
  - No website or BOSS Score link anywhere. [data]
  - Never asks for referrals from clients, network or partners. [ask] Fix: referral ask in the client rhythm.
  - Old network never told what they do now. [ask] Fix: one announcement post plus a personal message to the warm list.

## 2. Accepted: seen, but they didn't connect or open

*Sheet: Connection rate. Research: our average 17%, market about 28%.*

- **Profile turns them off.** See 0, Profile isn't ready.
- **Wrong people.** See 1, Can't find the right people. A good note can't fix a bad list.
- **Note hurts acceptance**
  - Link in the note (11% accept, 0 meetings). Fix: no links.
  - Pitchy or long note. Fix: test blank against a short proof note. Blank gets most accepts, a proof note gets 2-3x the meetings.
- **Email: not opened**
  - Subject line reads like marketing. Fix: short, plain, lower case, about them.
  - Sender name is a company or "info@". Fix: their own name.
- **Changes notes too often, never clean data.** [data] Fix: lock one version for 50-100 sends.

## 3. Interested: they saw it but didn't want a call

*Scoreboard: Outbound to interested (target 1%), Inbound to interested. Sheet: Replied, Interested, Interest rate.*

- **Didn't find it valuable**
  - No result they can picture: no number, no before and after. Notes with no result got under 1%. [data: message text] Fix: one real result.
  - Hook in jargon ("MRR", "risk management", "staff turnover"). Every jargon hook got under 1%. Fix: one plain want: profit, revenue, margins.
  - Hook doesn't point at what the coach sells, so they think it's a sales agency. Fix: hook matches the offer.
  - All about the coach. Fix: about the owner.
  - Uses the company name instead of the industry. Fix: industry callout (11 of 16 notes hit 1% or more).
  - No pain, just "growth" talk. Fix: a real question ("Could you take a week off without your laptop?").
- **Felt like spam**
  - Copy-paste, no sign the coach knows who they are. Fix: one real detail from their site or posts. For the top 100, the first lines can't be pasted to anyone else.
  - Pitches a "free coaching discovery call" in message one. Fix: soft question first, no pitch.
  - Fake scarcity. Fix: drop it.
  - "As I mentioned in my connection note…" after a blank invite. [data]
- **Asks too much**
  - Heavy question that needs a long answer. Fix: yes/no or 1-10 questions they can answer in a queue.
  - Call sounds like a coffee chat. Fix: name what they leave with (3-year map, 90-day plan, even if they never buy).
- **Right person, wrong time**
  - No follow-up after message one. A fifth of the interest comes after message two. [data] Fix: keep the full sequence.
  - Sequence ends, never contacted again. [data] Fix: long-term nurture: useful content, an occasional ask.
  - Only about 3% are ready now, and a booked call takes around 26 messages over 1-4 months. Fix: patience plus nurture. Judge on months, not days.

## 4. Replies: they answered and the coach dropped it

*Not on the Scoreboard yet. A big hidden leak.*

- Coach never replies. 29% of replies got no answer, including 1 in 8 who wanted to talk. [data: synced inbox] Fix: Ava flags unanswered replies the same day.
- Replies days later, they've cooled. [data: reply time] Fix: inbox power hours: morning, lunch, end of day.
- Misses buying signals (a question back, "tell me more") and treats them as small talk. [data] Fix: Ava tags interested replies.
- Answers a question with a wall of text and no next step. Fix: short answer, then ask for the call.
- Argues with or ignores a "not now". Fix: turn it into a dated follow-up.
- Replies sit in the tool, not their inbox, so they never see them. [data]

## 5. Booked: interested, but no Constraint Call booked

*Scoreboard: Interested to booked (target 50%, Great 80%). Sheet: Interested → Value Session %.*

- Sends a bare calendar link. One slot books 22%, two slots 43%. Fix: offer two times, link as backup.
- Endless "when works for you?". Fix: two times, a yes, invite sent at once.
- Slow to propose times. Fix: every interested reply gets times the same day.
- "Later" vanishes. Fix: dated follow-up plus a task.
- No follow-up cadence: one nudge, then silence. Fix: day 0, day 1, day 4 ("shall we park this?").
- One channel only. Fix: get their number and call. Email too.
- Few open slots, or calls 2 weeks out. [data: calendar] Fix: more short slots, 1-3 days out.
- Booking link broken, wrong time zone, or calendar not connected. [data]
- Booked, but never recorded, so it looks like a miss. [data]

## 6. Showed: booked, but didn't turn up to the Constraint Call

*Scoreboard: Constraint Call show rate (target 100%). Sheet: Show %. GHL doesn't record no-shows yet (job 198).*

- Booked 7-10 days ahead, they forget. Fix: same day, next day or day after. Pull calls forward.
- One generic reminder. Fix: 24h and 3h automated, plus a personal message the night before, the morning of, and 60 minutes before.
- No reason to show up. Fix: name what they get on the call.
- No video link, the wrong one, or the invite never reached their calendar. [data]
- No-show never followed up to rebook. [data] Fix: rebook message within the hour.

## 7. Next step: Constraint Call happened, no Profit Roadmap call booked

*Scoreboard: Constraint Call to roadmap (target 80%). Sheet: Follow-Up Call added.*

- Call turns into free coaching with no diagnosis. [ask, call recording] Fix: Constraint Call script, find the one constraint.
- Coach talks about themselves, the owner never feels the gap. Fix: questions, not a presentation.
- Wrong person on the call (not the decision maker, or the business is too small). Fix: qualify before booking.
- Ends with "have a think", no next step. Fix: recap the pain, then 1-10 on how serious they are. 8+ books the Roadmap call.
- Forgets to book while they're keen. Fix: book it before the Zoom ends.
- Can't handle objections, so avoids asking. Fix: script 3-5 objections, turn each into a reason to meet again. Practise in the simulator.
- Coach not ready to run the call, so avoids booking any. [data: simulator not done] Fix: simulator reps first.

## 8. Showed: Profit Roadmap call booked, but no-show

*Scoreboard: Roadmap show rate.*

- Treated casually, no reminders. Fix: same reminder stack as the first call, plus a clear agenda ("go / no-go").
- Nothing of value in between, energy fades. Fix: same-day recap of their issues plus a one-page 3-year / 90-day picture.
- Partner or co-director not invited. Fix: invite whoever has a say.

## 9. Closed: Roadmap call happened, no client

*Scoreboard: Close rate (target 25%, Great 50%). Sheet: Close rate %, Sales opportunities.*

- Offer is fuzzy, they can't see the path. Fix: Goal, Path, Role.
- "What if it doesn't work?" Fix: first-30-days guarantee.
- Tight on cash. Fix: structured on-ramp (lower first 3 months or a 90-day project), not a discount.
- Pushes for a discount. Fix: hold the price, change the terms (shorter start, fewer sessions).
- Coach hesitates on the price or apologises for it. [ask, recording] Fix: price line from Scripts, practised.
- Never actually asks for the decision. Fix: a direct close question.
- "Need to think" with no follow-up date. Fix: 48-hour decision call.
- Needs someone else's yes, and that person wasn't there. Fix: a call with both.
- Said yes but never paid: no link, no agreement. [data: Stripe] Fix: payment link and agreement sent on the call.

## 10. Activated: they signed, but never got going

*Not on the Scoreboard yet. Feeds months kept.*

- Slow or messy onboarding, the buzz fades before session 1. Fix: welcome pack, session 1 booked within 7 days.
- No agreement, expectations unclear. Fix: Keep Clients agreement.
- No long-term plan at the start. Fix: 3-year map plus 90-day plan in month one.
- No quick win in the first 30 days. Fix: pick one visible win early.
- Too much homework, the owner feels overwhelmed. Fix: one thing at a time, the biggest constraint.
- Owner doesn't do the actions between sessions. [ask] Fix: challenge it kindly, check they agree with the change.

## 11. Kept: they left too early

*Scoreboard: Months a client stays (target 12). Sheet: Cash from old clients.*

- Drift after first wins, no renewal points. Fix: quarterly 3-year and 90-day reset sessions, each a re-contract.
- Pause or cancel because sessions get swallowed by the day job. Fix: protect the session, challenge the firefighting.
- Can't see the progress. Fix: track profit, cash and time freed, and show it each quarter.
- Coach becomes a friend, no challenge left. Fix: hold them to the plan.
- No longer-term option for keen clients. Fix: offer 6-12 months as a choice, with a bonus, not a discount.
- No next level for happy, stable clients. Fix: team sessions, manager coaching, a company plan day as add-ons.
- Payment fails and nobody chases it. [data: Stripe] Fix: dunning plus a personal message.
- No client end dates recorded, so churn is invisible. [data; job 198]

## 12. Paid: enough clients, not enough money

*Scoreboard: Fee a month (target £2,000). Sheet: Cash from new clients, Cash in.*

- Price too low for the value. Fix: raise a step every 2-3 clients until the close rate drops.
- Only month-to-month, cash is lumpy. Fix: optional 90-day or 6-month package, or pay in full for 6 and get 1 free.
- No cash spikes, only base fees. Fix: a Fast Cash play each quarter (strategy day, annual prepay).
- Invoices late, or never sent. [data]

## 13. Kept the money: the practice doesn't hold up

*Sheet: Cash out, Net cash. Scoreboard: 20-client cap.*

- Costs grow as fast as cash in. Fix: cap spending that isn't needed, add tools only with clear payback.
- Full at 20 clients, no room to grow, no time for outreach. [data] Fix: raise the price, or run groups.
- Outreach stops while delivering, a gap follows 3 months later (feast and famine). [data: sends drop as clients rise] Fix: a minimum weekly outreach block that never moves.
- Burnout. [ask] Fix: Power Plan with Freedom days.

## Gaps to decide on

- Steps 0, 1 (delivery), 4 and 10 aren't on the sheet or the app Scoreboard yet. Step 4 is the biggest (29% of replies unanswered) and Ava can already see it from synced inboxes.
- Many [data] checks need job 198 (no-shows, close, client end dates).
- The sheet's Fix The Constraint tab has no email rows. Email is added under steps 1 and 2.
