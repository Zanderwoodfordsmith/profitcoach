import { NextResponse } from "next/server";

import { agreement, latestDigest, listReviewChats } from "@/lib/agent/chatReview";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

/** Admin → Ava → Chats: every chat with Ava, the latest "things to fix" and how often the AI agrees with BCA. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const [chats, digest] = await Promise.all([listReviewChats(), latestDigest()]);
    return NextResponse.json({ chats, digest, agreement: agreement(chats) });
  } catch (err) {
    console.error("ava chats list:", err);
    return NextResponse.json({ error: "Could not load Ava's chats." }, { status: 500 });
  }
}
