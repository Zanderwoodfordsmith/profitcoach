# Call simulator (version 1, 23 Oct 2026)

Get Clients → Scripts → the full-width bar at the bottom → `/coach/script/simulator`.
Admin-only until released. Same engine as the Client simulator: one ElevenLabs
agent with a prompt per call, and the Client simulator's owners as prospects.

## What a coach picks

- **Owner:** the Client simulator's cast. Their sales side (why now, goal,
  who decides, the real worry and so on) is in `src/lib/callSimulator/prospects.ts`.
  A new client only shows up here once it has a profile.
- **Call:** cold call, new lead call, booking objections, BOSS Score Review,
  Profit Roadmap call, objections after the price, no-show, reschedule.
- **Start at:** any part of the review or the Profit Roadmap call. On the call
  screen, later parts are buttons that skip ahead.
- **Objections** (the two drills): up to four, raised in the order picked, or
  Surprise me (three or four at random). They're read from the Scripts
  (`src/lib/salesCall/library/objections.ts` and `src/lib/salesCall/objections.ts`),
  so changing a script's wording changes the simulator too.
- **Level:** Easy, Medium, Hard. On Hard the first objection hides a real worry.

## How it's scored

Every area is 1 to 5, and the score is a percentage, so a whole call, a call
started halfway and a two-objection drill can be compared.

- **The call's parts** (or each objection in a drill), from `CALLS` in
  `src/lib/callSimulator/calls.ts`. Drill objections are scored against the
  four steps in "How to handle any objection" (booking) or the Profit Roadmap
  call's version of them (close).
- **Five sales skills**, on every call (`SALES_SKILLS`): Leads the call,
  Questions and listening, Their reasons, Calm confidence, Clear next step.
- **Outcome:** won, a dated next step, or no next step, measured against
  each call's `win`.

## When Alex and Yan's rubric arrives

Their setter and sales rubric replaces the guides in `calls.ts`: each part's
`signs` and `misses`, and `SALES_SKILLS`. The scorer (`scoreCall` in
`src/lib/callSimulator/ai.ts`) reads only those, so no other code needs to change.
Swapping the five skills for theirs is fine; the percentage adjusts to any count.

## Data

Table `call_sim_sessions` (migration `20271023120000_call_simulator.sql`, applied).
