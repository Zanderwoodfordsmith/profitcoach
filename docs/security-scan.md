# Security scan (Rafter), on request only

Run this only when Zander asks ("run rafter", "security scan"). It is not part
of normal feature work, marking done, or opening a PR.

1. Export only the key from `.env.local` (never `source` the file, never pass
   `--api-key`; the CLI's dotenv loader only reads `.env`):
   `export RAFTER_API_KEY="$(grep -E '^RAFTER_API_KEY=' .env.local | cut -d= -f2- | tr -d "'\"")"`
2. `rafter secrets .` on the working tree (local, secrets only, not a code scan).
3. `rafter run --format json` (remote SAST + SCA + secrets). It scans the
   **pushed GitHub ref**, so push the branch first if it should see new commits.
4. `rafter run --mode plus` is a paid deep-dive. Only when he asks for one.
