import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { syncUnipileInboxForCoach } = await import(
    "../../src/lib/unipile/inboxSync"
  );
  const t0 = Date.now();
  const result = await syncUnipileInboxForCoach(
    "cb501f32-6c3e-41ef-b1fa-9bc44916df7c",
    {
      force: true,
      minIntervalMs: 0,
      deadlineAt: Date.now() + 90_000,
    }
  );
  console.log(JSON.stringify(result), `${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
