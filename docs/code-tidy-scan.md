# Code tidy-up scan (6 Nov 2026)

Read-only. Nothing was changed. Job 210.

## The short version

The app is 532,000 lines. Two scanners ran over it: one that finds
repeated code, one that finds code nothing uses. Then the top findings
were checked by hand.

- **Repeated code: 1.5% of lines.** That is low. The app is big because
  the product is big, not because the same thing is written many times.
- **Unused app code: 34 files, about 7,000 lines**, confirmed by hand.
  Most were orphaned in late October when pages were reshuffled.
- **Twins:** a few pages exist twice with small differences, and a few
  design versions are still side by side waiting for a pick.
- **The real cost is six giant files** (3,000 to 7,000 lines each). They
  do not make the app slower for coaches, but they make every change
  slower and riskier, and cost more to edit with AI.

## Ranked list

| # | What | Size | Risk | What it buys |
|---|------|------|------|--------------|
| 1 | Delete the 34 files nothing imports | 7,000 lines | Low | Less to read and search; no behaviour change |
| 2 | Pick the design versions still side by side: Scoreboard V1 or V2, BossGrid plain / Glass / Transposed, Blueprint Classic look | ~1,500 lines | Low once picked | Decisions, not refactoring |
| 3 | Membership page twins: `MembershipPageClient` and `MembershipUpdatePageClient` are 1,363 and 1,351 lines, only 142 lines differ (copy, icons, column widths). Nothing in the app links to `/membership-update` | 1,300 lines | Medium (public sales page) | One page to maintain |
| 4 | API routes doing their own sign-in check: 31 routes check the token by hand and 9 define their own `requireAuth`, while `requireAdmin` and `requireCoachRequest` helpers already exist | ~700 lines | Medium (must test each route) | One place to fix security |
| 5 | Other twin pairs: booking embed / public book page (249 shared lines), join checkout / hybrid checkout (197), BOSS Pro results / Scorecard results (159), Venn diagram / Petal diagram (139) | ~750 lines | Medium (public pages) | Fix once, not twice |
| 6 | Split the giant files: `MessagingInbox` 7,012 lines (81 pieces of state), `RoadmapJobsBoard` 3,612, `CampaignPoolHub` 3,606, `AdminSupportPage` 3,335, `admin/page.tsx` 3,156, `PostDetailModal` 3,081 | No fewer lines | Medium to high | Faster, safer changes from now on |
| 7 | Small stuff: 1,569 unused exports and types; `undici` package unused; `pg` and `ffprobe` only used by scripts | Tiny | Low | Tidiness |

## The 34 unused files

Biggest first, with the date each was last changed.

| Lines | Last changed | File |
|------:|------|------|
| 907 | 28 Oct | `src/components/campaigns/CampaignAudiencePanel.tsx` |
| 892 | 25 Oct | `src/components/academy/LeadFlowMap.tsx` |
| 850 | 28 Oct | `src/components/settings/DirectorySettingsTab.tsx` |
| 680 | 28 Oct | `src/components/admin/CoachesMonthlyBarChart.tsx` |
| 504 | 25 Oct | `src/components/admin/SwipeToCompleteTodoList.tsx` |
| 421 | 25 Oct | `src/components/campaigns/LinkedInInterestQueue.tsx` |
| 349 | 28 Oct | `src/components/campaigns/OutreachActivityHeatmap.tsx` |
| 265 | 18 Oct | `src/components/settings/FunnelSettingsClient.tsx` (and `FunnelSettingsTab.tsx`, 954 lines, which only it uses) |
| 234 | 25 Oct | `src/components/practice/BlueprintAssistant.tsx` |
| 217 | 25 Oct | `src/components/community/LadderLevelUpsCard.tsx` |
| 190 | 28 Oct | `src/components/feedback/FeedbackFormCard.tsx` |
| 160 | 13 Aug | `src/components/join/JoinOfferPage.tsx` |
| 144 | 25 Oct | `src/components/practice/CommandCenter.tsx` |
| 140 | 25 Oct | `src/components/booking/BookingCalendar.tsx` |
| 120 | 28 Oct | `src/components/prospects/ProspectTagsEditor.tsx` |
| 115 | 28 Oct | `src/components/practice/PracticeComments.tsx` |
| 114 | 28 Oct | `src/components/prospects/ProspectCrmLinkModal.tsx` |
| 104 | 19 Oct | `src/lib/practiceKnowledge/standard.ts` |
| 94 | 25 Oct | `src/components/practice/SessionGuide.tsx` |

Plus 15 files under 80 lines each.

**One question this raises:** the Funnel settings tab (your links, CRM
and calendar, and the two biggest tutorial videos) is not reachable from
anywhere. Was it replaced on purpose, or did it fall off?

## Not a problem

- `scrollcraft/builds`: the served marketing sites.
- `.claude/skills` and `.cursor/skills`: design tooling, not deployed.
- 170 test files flagged as unused: a false alarm, they run as tests.
- `actors/linkedin-connect/node_modules` (149 MB): not in git.

## A plan in sections

One section per ship. Each one: typecheck, click through on 3002, stage,
then live. Never two sections in one ship.

1. **Clear out** (one session): delete the 34 files, remove the unused
   exports, pick the design versions. No behaviour changes, so the
   check is "everything still works".
2. **Sign-in helpers** (one session per area: client, coach, community):
   move each route onto the existing helper, test each route.
3. **Twins** (one pair per session): membership first if
   `/membership-update` is dead, else booking.
4. **Giant files** (one file per session, Messaging last): split by
   screen or panel. No fewer lines, but every later change gets safer.

Steps 1 and 2 are where most of the value is. Steps 3 and 4 are worth
doing only for the files you expect to keep changing.
