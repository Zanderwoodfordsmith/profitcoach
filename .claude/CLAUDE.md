<!-- rafter:start -->
## Security: Rafter (surface-driven review gate)

Rafter is this project's security review gate — driven by the change's **security
surface**, not by the task label. When a diff touches a real surface (below), it is
**not complete** until a rafter skill (or `rafter run`) has reviewed it: don't mark
done, don't hand off, don't open a PR without that pass. When it touches **none** of
that surface — research / experimental / local-only / throwaway code (training
scripts, data analysis, plotting, model eval, notebooks, pure computation over
trusted local data) — a quick surface check is enough; proceed without the full
gate. Judge by the diff's actual surface, not the "research" label: research code
that reads a secret, shells out, hits the network, parses untrusted input, or bumps
a dependency still gets the full gate.

**Stop and invoke when the change touches that surface:**

- Designing auth, payments, credentials, tokens, sessions, file upload,
  user/untrusted data, deserialization, network endpoints, or data deletion
  → **`rafter-secure-design`** (before writing code).
- Diff touches user/untrusted input, SQL/query building, shell/exec, auth,
  credentials, file paths, (de)serialization, crypto, network endpoints/outbound
  fetchers (SSRF), data deletion, or dependencies → **`rafter-code-review`** +
  `rafter run` (before declaring done).
- About to install or forward a third-party SKILL.md, MCP manifest, Cursor
  rule, or agent config → **`rafter-skill-review`** (before copying anywhere).
- Security-adjacent but the angle isn't clear → **`rafter`** (the router skill,
  powerful toolkit to help you write more secure code).

**CLI:**

- `rafter run` — remote SAST + SCA + secrets (real code analysis, needs `RAFTER_API_KEY`)
- `rafter secrets .` — local secrets only (offline; NOT a code-security scan)
- `rafter run --mode plus` — everything in default (`--mode fast`) plus
  agentic deep-dives (needs `RAFTER_API_KEY`). **Pre-authorized in this
  repo** (`scan.plus_requires_approval: false` in `.rafter.yml`).
<!-- rafter:end -->

## Code Security Engine (in-loop, this project)

Do not treat Rafter as a separate cleanup step. On every **meaningful** code
change (app behavior, APIs, SQL, auth, payments, webhooks, user data, deps,
infra — not comments/docs/formatting):

1. Export **only** `RAFTER_API_KEY` from `.env.local` (do not `source` the
   whole file). Never pass `--api-key`. The CLI's dotenv loader only reads `.env`.
   `export RAFTER_API_KEY="$(grep -E '^RAFTER_API_KEY=' .env.local | cut -d= -f2- | tr -d "'\"")"`
2. `rafter secrets .` on the working tree, then `rafter run --format json`
   (remote SAST + SCA + secrets). Add `--mode plus` on security-surface diffs,
   when fast mode flags something, and before declaring the work done — **when
   plus quota remains**. If plus remaining is 0, skip plus, say so, keep fast.
3. Incorporate findings before finishing. Critical/high + high confidence must
   be fixed. A secrets-only pass is not a code-security scan.

`rafter run` analyzes the **pushed GitHub ref**. Scan local uncommitted work
with `rafter secrets`; push the branch if CSE should see those commits.
