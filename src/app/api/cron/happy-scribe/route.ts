import { NextResponse } from "next/server";

import { isCronRequest } from "@/lib/cronAuth";
import { advanceTranscriptionQueue } from "@/lib/happyScribe/queue";

export const maxDuration = 300;

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
