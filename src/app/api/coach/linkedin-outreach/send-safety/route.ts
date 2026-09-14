import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  accountSendSafetySnapshot,
  loadCoachLinkedInSendSettings,
  updateAccountSendSettings,
} from "@/lib/unipile/accountSendPlan";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const snapshot = await accountSendSafetySnapshot(auth.coachId);
    if (!snapshot) {
      return NextResponse.json({
        available: false,
        reason: "not_connected",
        message: "Connect LinkedIn to configure sending safety.",
      });
    }
    return NextResponse.json({ available: true, ...snapshot });
  } catch (err) {
    console.error("linkedin send-safety GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  try {
    const account = await loadCoachLinkedInSendSettings(auth.coachId);
    if (!account) {
      return NextResponse.json(
        { error: "Connect LinkedIn first." },
        { status: 400 }
      );
    }
    await updateAccountSendSettings(auth.coachId, account.id, body);
    const snapshot = await accountSendSafetySnapshot(auth.coachId);
    return NextResponse.json({ available: true, ...snapshot });
  } catch (err) {
    console.error("linkedin send-safety PATCH", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed." },
      { status: 500 }
    );
  }
}
