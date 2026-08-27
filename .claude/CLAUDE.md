<!-- rafter:start -->
## Security: Rafter (on-demand)

Rafter is available in this project but **not part of the implement loop**.
Do not run `rafter run`, `rafter secrets`, skill walks, or the rafter
sub-agent after normal feature work, before marking done, or before a PR
unless the user explicitly asks (e.g. “run rafter”, “security scan”).

When they do ask:

- Diff review → **`rafter-code-review`** and/or `rafter run`
- Feature design they want reviewed first → **`rafter-secure-design`**
- Installing or forwarding a third-party SKILL.md / MCP / agent config
  → **`rafter-skill-review`** (still do this before copying third-party agent assets)
- Angle unclear → **`rafter`** router skill

**CLI** (export only `RAFTER_API_KEY` from `.env.local`; never `source` the file):

- `rafter run` — remote SAST + SCA + secrets (needs `RAFTER_API_KEY`)
- `rafter secrets .` — local secrets only (NOT a code-security scan)
- `rafter run --mode plus` — agentic deep-dive when asked
<!-- rafter:end -->

## Code Security Engine (on-demand, this project)

Do **not** scan on every meaningful change. Ship the work; run CSE when asked.

When asked to scan:

1. Export **only** `RAFTER_API_KEY` from `.env.local` (do not `source` the
   whole file). Never pass `--api-key`. The CLI's dotenv loader only reads `.env`.
   `export RAFTER_API_KEY="$(grep -E '^RAFTER_API_KEY=' .env.local | cut -d= -f2- | tr -d "'\"")"`
2. `rafter secrets .` on the working tree, then `rafter run --format json`.
   Add `--mode plus` only if they want a deep-dive and quota remains.
3. A secrets-only pass is not a code-security scan.

`rafter run` analyzes the **pushed GitHub ref**. Scan local uncommitted work
with `rafter secrets`; push the branch if CSE should see those commits.

## Map: where the truth lives

This folder is a map, not a knowledge base. Read the source of truth at these
paths when needed; do not duplicate their content here or anywhere in `.claude/`.

**Brand and product truth**

- `PRODUCT.md` (repo root) — durable product and brand context for design work.
  Impeccable reads it before every design command. Zander edits this directly.
- `content/ai-knowledge/PROFIT_COACH_AI_ROUTER.md` — **short map only** (skills,
  knowledge files, Create hub, coach brain keys). Loaded first in every coach AI
  prompt. Edit in app: **Admin → Brand → Core brain → Knowledge**. Do not bloat
  it with canon; that lives in the other files below.
- `content/ai-knowledge/` — brand brain canon: `methodology.md`, `icp.md`,
  `business-profile.md`, `brand-voice.md`, `offer-stack.md`, `writing-rules.md`
  (always loaded); `avatar-profile.md`, `copywriter-knowledge.md` (copy skills).
- `src/lib/profitCoachAi/registry.ts` — skill ids, programme order, instructions.
- `src/lib/profitCoachAi/studioHub.ts` — Create hub cards and skill links.
- Admin UI: **Brand → Core brain** — Knowledge (canon files), **Skills & tools**
  (Create hub cards + linked skills in programme order).
- `content/ai-knowledge/writing-rules.md` — binding for ALL copy. No em dashes.

**Key marketing surfaces**

- `src/app/home-v3/` — new brand homepage (staging URL, noindex until promoted)
- `src/app/pam/` — Pam's live coach page (theprofitcoach.com/pam)
- `src/app/score` + `src/app/landing/` — BOSS Score opt-in funnel
- `src/components/profitSystem/` — brand graphics (roadmap, levels, hexagons)
- `src/components/BossCharts/BossWheel.tsx` — app wheel (marketing pages use the
  custom wheel inside `home-v3` instead)

**Design tooling**

- `.claude/skills/impeccable/` and `.cursor/skills/impeccable/` — installed
  copies of the Impeccable design skill. Managed by `npx impeccable update`;
  never hand-edit.
- `.cursor/hooks.json` — pre-edit design-slop detector hook (offline).
