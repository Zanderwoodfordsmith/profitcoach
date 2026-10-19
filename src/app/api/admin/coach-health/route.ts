import { NextResponse } from "next/server";
import { loadCoachHealth } from "@/lib/coachHealth";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    return NextResponse.json({ coaches: await loadCoachHealth(), generated_at: new Date().toISOString() });
  } catch (err) {
    console.error("coach health:", err);
    return NextResponse.json({ error: "Could not load coach health." }, { status: 500 });
  }
}
