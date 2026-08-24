# Product roadmap — September relaunch and Q4

**The live tracker is now `/admin/roadmap`** (roadmap_jobs table, seeded from
this doc on 22 Aug 2026; manageable via UI or the AI panel from any screen).
This file remains the strategic snapshot of the plan as agreed.

Working tracker for the relaunch plan agreed 22 Aug 2026. Full audit behind
this plan: four-track code review of Get Clients, admin, backend systems, and
academy.

Statuses: `todo` · `doing` · `done` · `blocked`

## Beat 1 — relaunch (target: Sept 1)

| # | Job | Status | Notes / blocked by |
|---|-----|--------|--------------------|
| 1 | Flip gates: First Campaign + Ideal Client + Create to coaches | todo | Remove `adminPreview` + `ADMIN_PREVIEW_COACH_ROUTES` entries |
| 2 | Profile Optimizer launch scope: headline + About + banner copy only | todo | Multi-role experience editing deferred |
| 3 | Per-coach Lead Finder reveal/export caps | todo | Zander to pick numbers (suggested 250 list / 50 reveals per month) |
| 4 | Native booking default for new coaches + un-gate multi-calendar settings | todo | `StartApplyPanel` → native embed |
| 5 | Release Conversations with the booking flip | todo | Replies already route into it (`conversationReplyToAddress`) |
| 6 | Coach "you got a booking" notification email | todo | Currently only the Google Calendar event |
| 7 | "Activated in an hour" onboarding path (join → wizard → calendar) | todo | |
| 8 | Cut 5 Sales Nav classroom videos → tool-based lessons | todo | Get Calls / Win Clients groups |
| 9 | Pilot walkthrough with 2–3 real coaches | todo | After 1–4 |
| 10 | Wizard QA walkthrough end-to-end (punch list) | todo | Agent can run this on request |
| 11 | Delete/lock legacy unauthenticated `/api/message-generator` | todo | Security housekeeping |

## Beat 2 — content studio (target: mid-Sept)

| # | Job | Status | Notes / blocked by |
|---|-----|--------|--------------------|
| 1 | Coach access to Content tab + connect-LinkedIn flow | todo | OAuth tokens + scheduled posts already per-user |
| 2 | Verify LinkedIn dev app scopes approved for arbitrary members | todo | LinkedIn console check, not code |
| 3 | Post template library (editable) | todo | Zander has template ideas |
| 4 | AI panel drafts → Compose seed (artifact + panel pattern) | todo | First surface built in the panel pattern |
| 5 | "Month of posts" generation from brain + templates | todo | After 3–4 |

## Parallel track — website (theprofitcoach.com)

| # | Job | Status | Notes / blocked by |
|---|-----|--------|--------------------|
| 1 | Figma links for Profit System graphics | blocked | Waiting on Zander (frames + what the recent model update changed) |
| 2 | EMyth how-it-works screenshot + other reference designs | blocked | Waiting on Zander |
| 3 | Rebuild graphics as code SVG components (non-PNG) | todo | Targets: three-pillars, five-levels, nine-step-roadmap, owner-pyramid PNGs. Pattern exists: `ProfitSystemTriadDiagram.tsx`. Also reusable in coach content + reports |
| 4 | EMyth-style structural pass on new-home (pain → model → how it works → results → offer) | todo | Skeleton can start before graphics land |
| 5 | Promote finished page to `/`, retire funnel redirect + mirror hack | todo | After 3–4. Keep `PROFIT_COACH_FUNNEL_BASE_URL` as reversible fallback |
| 6 | Homepage primary CTA = BOSS assessment (lead-gen habit for partner model) | todo | Confirmed direction 22 Aug |

## In progress — AI panel (admin preview)

| # | Job | Status | Notes |
|---|-----|--------|-------|
| 1 | Docked panel (ClickUp-style push, fullscreen, screen context, brain) | done | Live in coach + admin layouts, admin-only. Verified end-to-end 22 Aug |
| 2 | Zander UX feedback pass (width, tone, per-page default skills) | doing | Panel running on localhost |
| 3 | First actions (mutation cores → tools), starting on Content | todo | Q4; adopt cores discipline in any mutation route touched from now on |

## Q4 (after relaunch beats)

- **October — close the sending gap:** pick automation route (Unipile-style API
  vs. extension scale-up vs. Connect AI handoff); outreach queue + per-lead
  send status; release Pipeline.
- **November — done-for-you groundwork:** admin-run campaigns per coach (40%
  partner model, manual first); release client coaching workspace tabs; first
  VocalLab consumer (voice notes on content); classroom consolidation pass 2.
- **December — the sidekick:** brain panel generalised with actions on every
  surface; "set my availability" style setup actions; GHL sunset decision;
  leads database expansion.

## Explicitly parked

- Server-side automated LinkedIn sending before October
- Voice notes / lesson narration until a consumer feature is chosen
- Slides / reshooting the product
- Full GHL replacement / CRM re-architecture
- Admin kanban / task tooling inside the product (ClickUp + this file instead)

## Waiting on Zander

1. Figma frame links for Profit System graphics + what the model update changed
2. EMyth how-it-works screenshot / other design references
3. Lead Finder cap numbers (list size / reveals per month)
4. AI panel UX feedback after using it
5. Confirm relaunch gate list (Beat 1 #1) and go/no-go date
