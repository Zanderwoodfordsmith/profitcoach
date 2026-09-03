import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { syncLinkedInInboxForCoach } from "@/lib/unipile/inboxSync";

export const maxDuration = 60;

/**
 * Soft LinkedIn inbox pull for the signed-in coach.
 * Respects a 2h cooldown unless `{ force: true }`.
 */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    force?: boolean;
  };

  try {
    const result = await syncLinkedInInboxForCoach(auth.coachId, {
      force: Boolean(body.force),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
}
