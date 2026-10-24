# Client simulator: morning review (overnight 23 to 24 Oct 2026)

Everything is on **localhost:3002** and admin-only (Keep Clients → Client simulator).
Roadmap jobs 115 and 129 are in Review.

## Do these first

1. **Cloudflare ran out yesterday, and it's still out.** Making the cast's
   portraits used up the free daily Workers AI allowance (10,000 "neurons")
   at about 19:40. The same account powers speech-to-text (Scripts → Listen,
   Ava dictation). It hadn't come back at 01:10, so it may be a rolling 24
   hours, which would mean **speech-to-text is down until about 19:40 today**.
   **Upgrade to Workers Paid ($5 a month)** to fix it now and stop it happening
   again; images then cost about a penny each. I didn't buy anything.
2. **Vercel environment, before staging:** add `ELEVENLABS_API_KEY` (the
   Stryv key, now in `.env.local`) and `SIMULATOR_ELEVENLABS_AGENT_ID`
   (`agent_8001m5mts24eemqvzdrhnqj4mtbz`).
3. **ElevenLabs plan:** a minute of practice costs about 1,000 credits. The
   Creator plan (shared with Stryv) has 300,000 a month, so about 300 minutes
   in total. Upgrade, or give BCA its own account, before coaches get this.

## What's new since yesterday evening

| What | Where to look |
|---|---|
| **The order you designed**: Jess (time management) first, then Sarah, Marcus, Kit, Priya, David, and Helen (certification) last | The faces on the [simulator](http://localhost:3002/admin/simulator) |
| **Jess Morgan**, rebuilt from your old "Easy practice: Time Management" agent: Leeds agency, 70-hour weeks, everything waits for her | First face |
| **Create your own**: describe a situation, say if it's real, the AI builds the client, you check "Does this sound right?", change anything, confirm. Share switch, "Make a face", delete | "Create your own" button, top right. Try it with a client you've coached |
| **From other coaches**: shared clients appear in a row under the stage | Appears once someone shares one |
| **Pause** replaces Time out: the client stops mid-word and nothing runs. Space or P pauses. "How am I doing?" gives the note only if you ask | On any call |
| **End without saving**: in the end and pause screens. Nothing is scored or kept in your history | On any call (not certification) |
| **Try that moment again**: on any missed chance, re-run just that moment. The client says their line again, you have another go, and it tells you if it was better | Report → "The call" → amber notes |
| **The call player**: waveform, chapters (Change, Objective…), drag to scrub, 1×, 1.5×, 2×, and the line being spoken lights up. Times match the recording exactly | [Jess report](http://localhost:3002/admin/simulator/20e99b1c-cadf-4a96-940c-b1a369bcad1c) |
| **Practise your weak spot**: your lowest area over recent sessions, with a client who drills it. Tips lean on that area | Card under the stage |
| **Certification scored twice**: two examiners, averaged area by area. If they differ by 2+ on an area, the reviewer sees it | Certification |
| **"AI at work" animation** while scoring, building a client or checking a replay | End any call |
| **Share with the community**: a ready-made post you can edit, show or hide the score, Feedback or Wins. Other coaches can open the report and listen back | Report → "Share with the community" |
| **Minutes limit**: 240 practice minutes per coach a month (admins unlimited). Admin review shows minutes by coach | [Review page](http://localhost:3002/admin/simulator/review) |

The **Call simulator** (sales calls, built by the other session under Get
Clients → Scripts) runs on this same call screen, so it got Pause and the
script panel too (and, at your request to that session, a "script in the middle" layout). My Sales calls row now links there instead of duplicating it.

## I checked

- Typecheck, lint, and 5 tests (every client × session × level builds a
  clean prompt; facts have hints; no em dashes; two-examiner averaging).
- Real voice calls in a browser with a recorded coach as the microphone:
  a full Jess session (stages moved Change → Objective → Choices → How), the
  report with notes and chapters, playing it back (waveform, sync, line
  highlight), and "Try that moment again" three times (each judged "Better").
- Create your own end to end: built "Darren Pryce" (a recruitment agency)
  from a description, changed him, confirmed him. The face fell back to
  initials because of the Cloudflare limit, as designed.
- Certification scored twice through the real finish route: the examiners gave
  25 and 26, and the old rounding made it 27, which is why I changed it. The
  new rounding is unit-tested, not re-run live. Rules re-tested earlier.
- Phone and desktop screenshots of the stage, call, report, player and
  Create your own.

## You check

- How the voices sound, especially Jess, plus your own call at Normal and Quick.
- **Helen and Jess "a touch more attractive"** (your note via the Call
  simulator session): warmer light, brighter smile, healthier skin and hair, a
  smarter top. Waiting on Cloudflare too. The current ones stay as
  helen-v1.webp and jess-v1.webp when I swap them.
- Jess's portrait: still a stand-in (an unused Helen variant), because
  Cloudflare was still out at 01:10. I retry once around 03:40. If that fails,
  ask me for Jess's face once Workers Paid is on (it takes a minute).
- Create your own with a real situation of yours: does the client feel right?
- **Not tested on purpose:** actually posting to the community. The database
  is shared with live, so a test post would have appeared to real coaches. The
  draft and the screen are tested; press "Post it" once yourself.

## Decisions I made (overturn any of these)

1. **One Pause button** instead of Time out and Pause. Help is a button inside
   the pause screen. Pausing is allowed in certification too (a phone call
   shouldn't fail you), with no help button there.
2. **Two examiners for certification only.** Practice stays one examiner, so
   it's quick and costs half as much. Halves round to the nearest even number,
   because rounding up made the total higher than both examiners.
3. **240 minutes a month per coach**, admins unlimited. You said you're happy
   to raise it: `MONTHLY_MINUTES` in `src/lib/simulator/server.ts`.
4. **Custom clients are always anonymised**: the AI changes every name and
   identifying detail, even for real situations. "Is this real?" shows as a
   tag ("Based on a real situation").
5. **Custom faces fail softly**: if there's no image budget, the client gets a
   navy initials disc and a "Make a face" button. It never blocks practice.
6. **Custom voices** come from the seven voices already in the account, picked
   by gender and age. No new voices get added per client.
7. **Shared posts go in "Requesting feedback"** by default, with "Wins" as
   the other choice. Hiding the score hides it in the post and on the report.
8. **Social media sharing left out.** Public links to recordings need more
   thought. Community only for now.
9. **Moment replays don't count** in your history, trend or weak spot. They
   show under the line they replay.
10. **No "End without saving" in certification**: dropping a bad attempt would undo the point. End it and it's scored.
11. **Sales calls removed from the Client simulator** and linked to the Call
    simulator (agreed with that session).

## Not done

- Classroom simulator lessons still point at Chatdash. Swap them when you
  release this.
- Practising with your own real clients (needs client data in the app first).
  It's in job 129's notes.
