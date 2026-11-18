import { POST as inboxSync } from "../route";

export const maxDuration = 300;

/** Nightly safety net (03:00-04:50, every 10 min): same cron, deep mode. */
export async function GET(request: Request) {
  const headers = new Headers(request.headers);
  headers.set("x-inbox-sync-deep", "1");
  return inboxSync(new Request(request.url, { method: "POST", headers }));
}
