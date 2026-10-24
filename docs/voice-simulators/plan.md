# Voice simulators: plan

23 Oct 2026. Draft for Zander. Nothing is built yet.

**The idea:** coaches practise real conversations out loud with an AI client
that feels like a real owner. They see where they are as they go, can stop
for help, get a scored report, and every session is saved so they can watch
themselves improve.

---

## 1. What we have today

- Six Retell agents, embedded in the Classroom through Chatdash, in both
  Coach Clients and Profit Coach Certification:
  Alex (legal SaaS, Hard), David (manufacturing, Hard), Marcus (chiropractor,
  Medium), Sarah (consultant, Medium), Helen (trophies, certification),
  and a Thai restaurant that wasn't in the paste.
  Originals: `docs/voice-simulators/retell-originals.md`.
- Background material in Drive (folder "AI Brain: Coaching Simulators +
  Assessment"): the scenario bank (10 challenges × 3 levels, 8 personalities,
  8 kinds of pushback, 5 industries) and the POWER-COACH scoring guide
  (out of 50).

**What's wrong with it:**
- To end, the coach has to say a magic phrase, and it often fails.
- The voice agent scores from memory while talking, so scores wobble.
- Nothing is saved, and there's no history, no stages and no help mid-call.
- Each client has one fixed difficulty.
- The clients are American (dollars, Capitol Hill, "American manufacturing"),
  and some look like real businesses.

---

## 2. Your questions, answered

### How do they pick? Cards with faces, or something else?

**Recommendation: one page, rows like a streaming app, with faces.**

- At the top is a large "Surprise me" button. It picks a client, a difficulty
  and a situation that suit the coach's level. They can change any of them
  before starting.
- Each row below is one kind of session ("Coaching sessions", "Onboarding
  sessions 1 to 4", "Tricky moments", "Follow-ups"). Each card in a row is one
  client, shown as a portrait with their name, business and a line about
  their problem.
- Clicking a card opens a short setup panel: the client's one-paragraph brief,
  **Easy / Medium / Hard**, **Tips on / off**, and Start.

Why rows and not one big grid: they keep navigation flat (one page, nothing to
click through) while leaving room to grow from 6 simulators to 40.

The faces matter. Practising with "David, 52, runs a precision engineering
firm in Sheffield" feels very different from picking a card that says
"Manufacturing, Hard". The faces would be made-up people, never stock photos,
in one consistent style. We'd choose the style from mockups: realistic
portraits or soft illustration.

```
┌───────────────────────────────────────────────────────────────┐
│  Simulator                                  [ ✦ Surprise me ] │
│                                                               │
│  Coaching sessions                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ face │ │ face │ │ face │ │ face │ │ face │ │ face │  →     │
│  │David │ │Alex  │ │Helen │ │Marcus│ │Sarah │ │Niran │        │
│  │Engin.│ │Legal │ │Trophy│ │Chiro │ │Consult│ │Thai │        │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
│  Onboarding sessions 1 to 4                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                          │
│  Tricky moments                                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │
│  Your last sessions          34/50 ▁▃▅▆ improving             │
└───────────────────────────────────────────────────────────────┘
```

### Should feedback be only at the end, or midway too?

**Both, but the coach chooses when. The AI never interrupts them.**

- **Time out** (a button, or the space bar): the client goes quiet and a panel
  slides in with a short note on how it's going, e.g. "You're in Anchors. You've
  covered what's in the way now. Ask what's stopped them before." Then
  **Back to the call**, and the client carries on as if no time had passed.
- **End and get feedback**: the full report.
- In an **assessment**, there's no time out and no tips.

The AI never breaks in by itself, because that ruins the feeling of a real
call, and that feeling is the whole point.

### Live help at the side?

**Yes, but light, and the coach can turn it off.**

During the call, a slim panel on the right shows three things:
1. **Where you are**: the five COACH stages as a bar that fills as they
   move through. This is always shown.
2. **Found so far**: the client's hidden facts appear as tiles when the coach
   gets them out ("£8M turnover", "Margins down from 18% to 8%"). This makes
   good listening visible and rewards real digging. It shows as "5 of 8
   found", and the missing ones stay greyed out.
3. **One tip** (only when Tips is on): one line, updated after each of the
   coach's turns. Never a list.

The tips panel slides in and out on the right at every level, Hard
included. On Hard it explains how to handle that kind of pushback. It's text
only, nothing spoken, so the call isn't interrupted.

### Specific sessions: onboarding 1 to 4, tricky moments, follow-ups?

Yes. Built the right way, each new simulator is mostly writing, not code.
Every simulator is three things put together:

| Piece | What it holds | Written once per… |
|---|---|---|
| **Client** | who they are, their business, hidden facts, personality, how they push back, what makes them open up | client |
| **Situation** | the kind of session, what the coach should achieve, the stages to track, the scoring guide | kind of session |
| **Difficulty** | how guarded, how much pushback, how fast they open up | level (3, shared by all) |

Any client can be used in any situation at any level. Six clients across four
kinds of session at three levels already gives 72 different calls.

The situations, in build order:

1. **Coaching session** (COACH): what the current six do. Scored out of 50
   with POWER-COACH.
2. **Onboarding sessions 1 to 4**: Profit system and dashboard, Leverage and
   the critical issue, The three-year plan, The ninety-day plan. Stages and
   scoring come from the steps already written in
   `src/lib/practiceKnowledge/clientSessions.ts`, so the simulator and the
   lessons always match.
3. **Tricky moments** (5 to 10 minutes each), one skill per session: the
   client is distracted, hasn't done the work, wants to change direction,
   wants to pause or cancel, pushes back on the fee, brings in a personal
   crisis, or blames the team. These tie in with the Coach Clients lessons
   (Remove Distraction, Prevent Overwhelm, Ownership and so on).
4. **Follow-ups that remember**: "Continue with David" starts session two.
   David remembers what was agreed last time, because it's saved, and the
   difficulty decides whether he did it. This is the one no off-the-shelf tool
   can do.
5. **Later, sales calls**: the BOSS Score Review, the Profit Roadmap call and
   objections, practised against the Scripts with the owner as the prospect.

---

## 3. The look

The aim is a modern, premium feel, not a copy of the Scripts layout.

- **The call itself happens on the navy stage** that Ava's full screen
  already uses (moving light, glass panels, `src/components/ava/`). Coaches
  already see that as "the AI room", and it looks premium straight away.
- **The client's portrait sits in the middle** with a soft ring of light that
  moves with their voice. The coach's own level shows as a small, quiet ring
  under it.
- **The COACH bar runs along the top** as five glass pills that light up in
  turn. Time out and End sit at the bottom, big and calm.
- **The report is a light page.** A large score ring out of 50 sits at the
  top, with ten small bars below it. Then "Moments": two or three quotes from
  their own call, each with a "Try instead" line. Then "Your one thing for
  next time". The coach can listen back to the moment each quote comes from.
- **History**: a simple line of their scores over time on the Simulator page.
  That's what keeps them coming back.

```
┌───────────────────────── navy stage ──────────────────────────┐
│   (C) Change ─ (O) Objective ─ ( A ) ─ ( C ) ─ ( H )   12:40  │
│                                                ┌────────────┐ │
│                  ╭──────────╮                  │ Found 3/8  │ │
│                  │   face   │ ← glows when     │ £8M  45 ppl│ │
│                  ╰──────────╯   speaking       │ 18%→8%     │ │
│               David · Precision engineering    │ ░░ ░░ ░░   │ │
│                                                │ Tip: ask   │ │
│                                                │ what he    │ │
│                                                │ CAN change │ │
│                                                └────────────┘ │
│              [ ❚❚ Time out ]   [ End and get feedback ]        │
└───────────────────────────────────────────────────────────────┘
```

Direction agreed 23 Oct: the Doer look (see Decisions, item 3). Next step:
mockups of the picker, the call screen and the report on 3002, admin-only,
before any wiring.

---

## 4. How it works underneath

- **Built 23 Oct, changed from the plan:** no server bridge. One ElevenLabs
  agent ("BCA Client simulator", Claude Sonnet 5.5 inside ElevenLabs) gets
  the client's prompt, opening line and voice at the start of each call.
  That works on localhost too, where a bridge can't. Code: src/lib/simulator,
  src/components/simulator, /api/coach/simulator.
- **Voice: ElevenLabs**, with the same setup as Ava's live calls. ElevenLabs
  handles hearing, turn-taking and speaking. Our server writes every line the
  client says (the "custom LLM" bridge, as in `src/lib/ava/voiceBridge.ts`).
  Each client gets their own ElevenLabs voice. Retell and Chatdash go.
- **The client's brain:** our bridge builds the prompt from client +
  situation + difficulty + what has happened so far. It runs on a fast Claude
  model, because speed matters on a call. We'd test Sonnet against Haiku for
  how real they sound.
- **Stage, facts found and tip:** after each of the coach's turns, the page
  sends the latest lines to a small, fast check that returns the stage, any
  newly found facts and one tip. It's cheap and runs alongside the call, so it
  never slows the client down.
- **Report:** when the coach ends, Claude reads the full transcript once,
  scores it against that situation's guide, and saves the scores with their
  quotes. The report and any spoken feedback both read the saved scores, so
  the numbers never change while it talks.
- **Spoken feedback (optional):** "Talk it through" starts a short second call
  in a different, coach-like voice. It follows your three steps: the score →
  three areas to work on → coaching on one area, asking the coach first.
- **Saved:** each session keeps the transcript, the audio link, stages,
  facts found, scores and report. Admins can see every coach's sessions.

### Data (additive migration)

- `sim_sessions`: coach, client, situation, difficulty, tips on, mode
  (practice / assessment), times, transcript, stage log, facts found,
  report, score, audio link, `follows_session_id` for follow-ups.
- `sim_assessments`: one certification attempt that groups its sessions,
  plus average, pass, reviewer and reviewer's changes.

Clients, situations and scoring guides live in code at first
(`src/lib/simulator/`), like the Scripts do, and can move into an admin
editor later.

### Certification

- Three sessions instead of one Helen call: three different clients, at
  least one on Hard, no tips, no time outs.
- The result is the **average**, and each session's report is kept.
- Admin review in `/admin`: read or listen, then confirm or change any score.
  The coach sees the final result.
- To check the AI scores the way you would, we'd run past examiner-marked
  transcripts through it, if the "AI Brain Coach Assessment Report" and
  "V1 AI Reports and comments" docs in Drive are those, and compare.

### Cost (to confirm)

Roughly £1 to £2 for a 20-minute session: ElevenLabs minutes plus Claude. I
haven't checked this against your ElevenLabs plan.

---

## 5. Build order

Each phase works on its own. Admins only until you release it.

1. **Mockups:** picker (two layouts), call screen and report, on 3002.
   No voice yet.
2. **Coaching sessions:** the six clients rewritten (UK, made-up names),
   difficulty dial, call screen with the COACH bar, End → report, history.
   Classroom lessons link to it in place of Chatdash.
3. **During the call:** Time out, Found so far, Tips, Talk it through.
4. **Certification:** three sessions averaged, plus admin review.
5. **Onboarding sessions 1 to 4.**
6. **Tricky moments and follow-ups that remember.**
7. **Sales calls**, linked to the Scripts.

---

## 6. Decisions

Zander, 23 Oct:

1. **British clients**, as long as the voices sound good. Made-up names.
2. **Name and place: "Client simulator", in Keep Clients**, because it's about
   being a better coach. Classroom lessons link to it.
3. **Look: the Doer reference** (Dribbble, two shots shared in chat). Near-real
   faces that fade into a soft, misty background with a glow behind them, very
   large light type, cream pill buttons, a calm single colour. We'd use the BCA
   navy in place of Doer's plum. The client picker becomes a row of faces like
   Doer's hero: the chosen client large in the middle, the others smaller and
   blurred either side. The call screen keeps that face as the centrepiece.
   Zander said it's "maybe a bit creepy" but liked it. The mockups should test
   how real the faces can be before they feel uncanny.
4. **Certification pass mark: probably 60%** (30 of 50). Zander thinks 60,
   possibly 70. To confirm.
5. **Tips on every level, Hard included**, as a panel that slides in and out
   on the right. On Hard, tips explain how to handle that client's kind of
   pushback, not just what to ask next.
6. **Later: tips from Pam's conference coaching sessions.** Label the
   frameworks and tools she uses in her coaching transcripts ("this is useful
   when the owner blames the market") and offer them as tips at the right
   moment.
