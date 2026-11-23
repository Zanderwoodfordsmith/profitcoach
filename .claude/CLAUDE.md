# Profit Coach app

## What this is

The Business Coach Academy (BCA) platform for Profit Coaches. One Next.js 16
app (App Router, Turbopack, Tailwind v4) on Supabase (Postgres, auth,
storage, migrations in `supabase/migrations`), Stripe billing, Vercel hosting.
**Pushing `main` deploys to production.**

- **Coaches** use the member app: Blueprint, Get / Win / Serve clients,
  Classroom, Vault, community. **Ava** is the in-app AI assistant.
- **Admins** (Zander and BCA staff) work under `/admin`.
- **Marketing pages** sell the BOSS Score funnel to UK owner-led businesses
  doing £1M+. Product and brand context: `PRODUCT.md`.
- Local dev runs on **localhost:3002**. Secrets are in `.env.local`: grep the
  one key you need, never `source` the file. Test as **Zander Demo** only.

## How to work here

- **Zander reviewing on 3002:** just edit the files. No commit, push or
  screenshots unless he says. One or two lines on what changed.
- **Overnight builds** ("I'm off to bed"): don't ask, decide. Work on a
  branch, commit only your own files, additive migrations, no spend, no
  LinkedIn sends. Write `docs/<feature>-morning-review.md` with "Decisions I
  made (overturn any of these)".
- **Agreed means do it now,** in the same turn. Only put work on the board
  (roadmap card or a proposal to approve) when it's too large to do now
  and needs his check first.
- **Design changes:** add the new version beside the old one until he has
  chosen; once he picks, remove the versions he passed on. Put the switch in
  the top title bar, just left of search (admin only), not in the page.
- **Keep navigation flat:** group by the thing itself, few layers, one
  sensible default instead of parallel variants. Admin-only tools never go
  inside coach views such as My Blueprint; put them in the admin section
  (Ava, Coaches, Tools and links).
- **Copy:** follow `content/ai-knowledge/writing-rules.md` (binding for all
  copy). Everyday words a 12-year-old understands. Never name or credit Jack.
- **Never delete profiles or auth users as cleanup.** Community tables cascade
  from profiles. Keep the name, remove the login (admin "Remove access").
- **After styling changes,** confirm the new classes landed in the served CSS.
  Turbopack can serve stale CSS: stop the server, delete `.next/dev`, restart.
- **Security scans (Rafter) only when he asks.** Steps: `docs/security-scan.md`.

## Roadmap workflow (every session)

The Academy roadmap (/admin/roadmap, table `roadmap_jobs`) is the one queue.

- Starting work on a job: move it to In progress. Finishing: move it to
  Review with three lines at the top of its notes: "Where to look:" (a
  localhost:3002 link), "I checked:" (each test you ran and what happened)
  and "You check:" (only what you couldn't test: taste, copy, real data,
  real admin logins; "Nothing" if so).
- Columns: In progress = being built. Review = built, he checks on 3002.
  Ready (status `done`) = he has checked it, not live yet. Live = coaches
  have it. No staging step (dropped 23 Nov).
- **You move the cards, never ask him to.** When he says a job is checked,
  decided or sorted, move it to Ready in the same turn.
- If his check finds something to change, the job goes back to In progress
  with the change added to its checklist, then returns to Review.
- Shipping: `ship "message"` (~/.npm-global/bin) = typecheck, commit
  everything on main, push main, which deploys live. Run it only when he
  says ship or publish. Then confirm the Vercel production build is Ready
  and you own the board: move every job whose work just went live and
  meets its Done when to Live, from any column, noting what you checked.
  One that doesn't meet it stays put, with the gap in its notes.
- Only a brand-new page or tab is built admin-only until it's ready. Changes
  to pages coaches already see are not gated; they go live with `ship`.
- Zander releases by name, never by job number: "release Scripts" = remove
  that page's admin gate and move its jobs to Live.
- A new idea mid-session goes to Ideas → Evaluate as a new job; don't start
  building it unless Zander says so.
- Every job has a **Done when** (its own field, above Scope): what finished
  looks like in a sentence or two. Review checks against it; anything new
  that isn't in it becomes a new job.
- **Urgent** flag = waiting costs money or risk; it jumps the queue whatever
  the scores. Only Zander sets it.

## Map: where the truth lives

This file is a map, not a knowledge base. Read the source of truth at these
paths when needed; do not copy their content here or anywhere in `.claude/`.

**Brand and product truth**

- `PRODUCT.md` (repo root): durable product and brand context for design work.
  Impeccable reads it before every design command. Zander edits this directly.
- `content/ai-knowledge/PROFIT_COACH_AI_ROUTER.md`: **short map only**, loaded
  first in every coach AI prompt. Edit in app: **Admin → Brand → Core brain →
  Knowledge**. Do not bloat it with canon.
- `content/ai-knowledge/`: brand brain canon (`methodology.md`, `icp.md`,
  `business-profile.md`, `brand-voice.md`, `offer-stack.md`, `writing-rules.md`
  always loaded; `avatar-profile.md`, `copywriter-knowledge.md` for copy skills).
- `content/agent/`: Ava's context (`AGENT.md`, `ROUTER.md`, one
  `capabilities/*/CONTEXT.md` per capability, loaded when opened).
- `src/lib/profitCoachAi/registry.ts` (skill ids, programme order) and
  `studioHub.ts` (Create hub cards). Admin UI: **Brand → Core brain**.

**Key marketing surfaces**

- `/` is the Scrollcraft site v4 (`public/site-v4`, rewrite in `next.config.ts`).
  `src/app/home-v3/` is kept for comparison.
- `src/app/pam/`: Pam's live coach page (theprofitcoach.com/pam).
- `src/app/score` + `src/app/landing/`: BOSS Score opt-in funnel.
- `src/components/profitSystem/`: brand graphics (roadmap, levels, hexagons).
- `src/components/BossCharts/BossWheel.tsx`: app wheel.

**Design tooling**

- `.claude/skills/impeccable/` and `.cursor/skills/impeccable/`: installed by
  `npx impeccable update`; never hand-edit.
- `.cursor/hooks.json`: pre-edit design-slop detector hook (offline).

## Keeping this file useful

Corrected on the same thing twice? Add one line here, or to the canon file it
belongs in, rather than only to memory. Keep this file under ~120 lines.
