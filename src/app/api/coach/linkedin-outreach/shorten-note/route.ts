import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { shortenNote } from "@/lib/campaigns/shortenNote";

export const runtime = "nodejs";

/** "Let Ava shorten it" on a note that's over LinkedIn's limit. */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { body?: unknown; max?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body.slice(0, 6000) : "";
  const max = typeof body?.max === "number" && body.max >= 50 && body.max <= 5000 ? Math.floor(body.max) : 300;
  if (!text.trim()) {
    return NextResponse.json({ error: "Nothing to shorten." }, { status: 400 });
  }
  const result = await shortenNote(text, max);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
