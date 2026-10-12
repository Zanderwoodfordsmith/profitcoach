import { NextResponse } from "next/server";
import { getLeadMagnet } from "@/lib/leadMagnets/catalog";
import { loadMagnetAudience } from "@/lib/leadMagnets/audience";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{ magnetId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    const status =
      auth.error === "Admin must pass x-impersonate-coach-id for this resource."
        ? 400
        : 401;
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status });
  }

  const { magnetId } = await context.params;
  const magnet = getLeadMagnet(magnetId);
  if (!magnet) {
    return NextResponse.json({ error: "Lead magnet not found." }, { status: 404 });
  }

  const { data: coachRow, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", auth.userId)
    .maybeSingle();

  if (coachError) {
    return NextResponse.json(
      { error: "Unable to load this lead magnet." },
      { status: 500 }
    );
  }

  const coachSlug =
    ((coachRow as { slug?: string | null } | null)?.slug as string | null)?.trim() ??
    null;

  const { searchParams } = new URL(request.url);
  const audience = await loadMagnetAudience({
    coachId: auth.userId,
    coachSlug,
    magnetId: magnet.id,
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  return NextResponse.json(audience);
}
