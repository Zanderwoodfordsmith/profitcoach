import { NextResponse } from "next/server";

import { retryTranscriptionItems } from "@/lib/happyScribe/queue";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "Server error." ? 500 : 401 },
    );
  }
  const body = (await request.json().catch(() => ({}))) as { itemIds?: unknown };
  if (
    !Array.isArray(body.itemIds) ||
    !body.itemIds.every((value) => typeof value === "string")
  ) {
    return NextResponse.json({ error: "itemIds must be an array." }, { status: 400 });
  }
  try {
    const retried = await retryTranscriptionItems(body.itemIds);
    return NextResponse.json({ retried });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not retry transcription items." },
      { status: 400 },
    );
  }
}
