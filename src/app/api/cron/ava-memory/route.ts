import { NextResponse } from "next/server";

import { ingestAll } from "@/lib/agent/memory/ingest";
import { isCronRequest } from "@/lib/cronAuth";

/** Every 30 minutes: take new Ava chats, call transcripts and LinkedIn posts into Ava's memory. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await ingestAll({ maxNotes: 25 })) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ava memory ingest failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
