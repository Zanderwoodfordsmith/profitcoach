import { NextResponse } from "next/server";
import { importLinkedInHistory } from "@/lib/linkedinHistory/importHistory";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

export const maxDuration = 300;

/** Import (or refresh) the coach's LinkedIn posts and newsletter issues. */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const result = await importLinkedInHistory(auth.userId, { maxBodies: 40 });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
