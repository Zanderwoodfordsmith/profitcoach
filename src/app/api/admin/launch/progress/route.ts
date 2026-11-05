import { NextResponse } from "next/server";

import { parseCoachIdHeader } from "@/lib/coachId";
import { launchProgressForCoach, launchProgressForLaunching } from "@/lib/launch/progress";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

/**
 * Launch jobs: how far each pinned thread's job has got. With ?coachId, one
 * coach (for their channel); without, everyone launching (for the board).
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error }, { status });
  }
  const raw = new URL(request.url).searchParams.get("coachId");
  try {
    if (raw) {
      const coachId = parseCoachIdHeader(raw);
      if (!coachId) return NextResponse.json({ error: "Unknown coach." }, { status: 400 });
      return NextResponse.json({ progress: await launchProgressForCoach(coachId) });
    }
    return NextResponse.json({ coaches: await launchProgressForLaunching() });
  } catch (err) {
    console.error("launch progress:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load launch progress." }, { status: 500 });
  }
}
