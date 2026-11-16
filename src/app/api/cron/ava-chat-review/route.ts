import { NextResponse } from "next/server";

import { reviewWaiting, writeDigest } from "@/lib/agent/chatReviewAi";
import { isCronRequest } from "@/lib/cronAuth";

/** Monday 7am: the AI reads the week's coach chats with Ava and writes the things to fix (Admin → Ava → Chats). */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const run = await reviewWaiting(50);
    const digest = run.reviewed > 0 ? await writeDigest() : { written: false, costUsd: 0 };
    return NextResponse.json({ ok: true, ...run, digest: digest.written });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ava chat review failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
