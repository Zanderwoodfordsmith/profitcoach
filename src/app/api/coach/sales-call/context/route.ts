import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { loadSalesCallCoach } from "@/lib/salesCall/coachContext";

export const runtime = "nodejs";

/** The coach's name, price and whether their Blueprint has a pitch yet. */
export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const coach = await loadSalesCallCoach(auth.userId);
  return NextResponse.json({ name: coach.name, price: coach.price, guarantee: coach.guarantee, hasPitch: Boolean(coach.pitch), proofCount: coach.proof.length });
}
