import { NextResponse } from "next/server";
import { parseCoachIdHeader } from "@/lib/coachId";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  loadDeck,
  loadIntroducers,
  loadNetworkSummary,
  rateConnection,
} from "@/lib/referrals/network";

export const runtime = "nodejs";

/** One coach's referral network: summary, next people to rate, members who know their prospects. ?only=deck for the next batch. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const url = new URL(request.url);
  const coachId = parseCoachIdHeader(url.searchParams.get("coachId"));
  if (!coachId) return NextResponse.json({ error: "Pick a coach." }, { status: 400 });

  try {
    if (url.searchParams.get("only") === "deck") {
      return NextResponse.json({ deck: await loadDeck(coachId) });
    }
    const [summary, deck, introducers] = await Promise.all([
      loadNetworkSummary(coachId),
      loadDeck(coachId),
      loadIntroducers(coachId),
    ]);
    return NextResponse.json({ summary, deck, introducers });
  } catch (err) {
    console.error("admin referrals:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load referrals." }, { status: 500 });
  }
}

/** Body: { coachId, publicIdentifier, rating: "known" | "unknown" | null }. null undoes a rating. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const coachId = parseCoachIdHeader(typeof body.coachId === "string" ? body.coachId : null);
  const publicIdentifier = typeof body.publicIdentifier === "string" ? body.publicIdentifier.trim() : "";
  const rating = body.rating === "known" || body.rating === "unknown" ? body.rating : body.rating === null ? null : undefined;
  if (!coachId || !publicIdentifier || publicIdentifier.length > 200 || rating === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  try {
    const found = await rateConnection(coachId, publicIdentifier, rating);
    if (!found) return NextResponse.json({ error: "Not in this network." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
