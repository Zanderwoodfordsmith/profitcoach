import { NextResponse } from "next/server";
import {
  canAccessCoachResource,
  requireCoachOrAdmin,
  resolveCoachTarget,
} from "@/lib/booking/resolveCoachTarget";
import {
  deleteZoomConnection,
  loadZoomConnectionStatus,
} from "@/lib/booking/zoomMeetings";

export async function GET(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const url = new URL(request.url);
  let target: Awaited<ReturnType<typeof resolveCoachTarget>>;
  try {
    target = await resolveCoachTarget({
      auth: { userId: auth.userId, role: auth.role },
      forSlug: url.searchParams.get("forSlug"),
      impersonateCoachId: auth.impersonateCoachId,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }

  const status = await loadZoomConnectionStatus(target.coach.id);
  return NextResponse.json({
    ...status,
    is_self: target.isSelf,
    can_manage: canAccessCoachResource(auth, target.coach.id),
  });
}

export async function DELETE(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let target: Awaited<ReturnType<typeof resolveCoachTarget>>;
  try {
    target = await resolveCoachTarget({
      auth: { userId: auth.userId, role: auth.role },
      forSlug: null,
      impersonateCoachId: auth.impersonateCoachId,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }
  if (!canAccessCoachResource(auth, target.coach.id)) {
    return NextResponse.json(
      { error: "Sign in as this coach to disconnect Zoom." },
      { status: 403 }
    );
  }

  await deleteZoomConnection(target.coach.id);
  return NextResponse.json({ connected: false, is_self: true });
}
