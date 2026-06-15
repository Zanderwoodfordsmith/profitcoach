import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  loadLandingStatActors,
  type LandingStatKind,
} from "@/lib/landingActors";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_KINDS = new Set<LandingStatKind>(["opt_in", "start", "finish"]);

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error || !auth.userId) {
    const status =
      auth.error === "Admin must pass x-impersonate-coach-id for this resource."
        ? 400
        : 401;
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status });
  }

  const coachId = auth.userId;
  const { searchParams } = new URL(request.url);
  const kindRaw = searchParams.get("kind")?.trim() ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!VALID_KINDS.has(kindRaw as LandingStatKind)) {
    return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
  }
  const kind = kindRaw as LandingStatKind;

  const { data: coachRow, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", coachId)
    .maybeSingle();

  if (coachError) {
    return NextResponse.json(
      { error: "Unable to load landing analytics." },
      { status: 500 }
    );
  }

  const coachSlug =
    ((coachRow as { slug?: string | null } | null)?.slug as string | null)?.trim() ??
    null;

  if (!coachSlug) {
    return NextResponse.json({ actors: [] });
  }

  const actors = await loadLandingStatActors(coachSlug, coachId, kind, from, to);
  return NextResponse.json({ actors });
}
