import { NextResponse } from "next/server";

import { advanceTranscriptionQueue } from "@/lib/happyScribe/queue";

export const maxDuration = 300;

function isCronRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const secrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.HAPPY_SCRIBE_CRON_SECRET?.trim(),
  ].filter(Boolean);
  return Boolean(bearer && secrets.includes(bearer));
}

/** Submit pending items and advance a bounded number of provider jobs. */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await advanceTranscriptionQueue()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription queue tick failed." },
      { status: 500 },
    );
  }
}
