import { NextResponse } from "next/server";
import { loadCallTableRows } from "@/lib/loadCallTableRows";
import {
  requireCoachOrAdmin,
  resolveCoachTarget,
} from "@/lib/booking/resolveCoachTarget";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Coach-scoped call list. Admins may pass ?scope=all on the admin hub.
 * Impersonation (x-impersonate-coach-id) always wins over the signed-in user.
 */
export async function GET(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const url = new URL(request.url);
  const wantAll =
    auth.role === "admin" && url.searchParams.get("scope") === "all";

  if (wantAll) {
    const calls = await loadCallTableRows(supabaseAdmin, { allCoaches: true });
    return NextResponse.json({ calls });
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

  const calls = await loadCallTableRows(supabaseAdmin, {
    coachId: target.coach.id,
  });
  return NextResponse.json({ calls });
}
