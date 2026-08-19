import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { normalizeOptimizerDraft } from "@/lib/linkedinProfileOptimizer/draft";
import type {
  LinkedInImportProfile,
  ProfileOptimizerDraft,
} from "@/lib/linkedinProfileOptimizer/types";

type StoredRow = {
  linkedin_url: string;
  scraped_at: string;
  snapshot: LinkedInProfileSnapshot;
  optimizer_draft: unknown;
};

function toProfile(row: StoredRow): LinkedInImportProfile {
  return {
    linkedinUrl: row.linkedin_url,
    scrapedAt: row.scraped_at,
    snapshot: row.snapshot,
  };
}

export async function GET(request: Request) {
  const authCheck = await requireCoachRequest(request, {
    allowAdminSelf: true,
  });
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  const [{ data, error }, { data: profileRow }] = await Promise.all([
    supabaseAdmin
      .from("coach_linkedin_profiles")
      .select("linkedin_url, scraped_at, snapshot, optimizer_draft")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("linkedin_url")
      .eq("id", coachId)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json(
      { error: "Could not load LinkedIn profile." },
      { status: 500 }
    );
  }

  const savedLinkedinUrl =
    (profileRow?.linkedin_url as string | null)?.trim() ||
    (data?.linkedin_url as string | null) ||
    null;

  if (!data) {
    return NextResponse.json({
      profile: null,
      draft: {},
      savedLinkedinUrl,
    });
  }

  const row = data as StoredRow;
  return NextResponse.json({
    profile: toProfile(row),
    draft: normalizeOptimizerDraft(row.optimizer_draft),
    savedLinkedinUrl,
  });
}

export async function PATCH(request: Request) {
  const authCheck = await requireCoachRequest(request, {
    allowAdminSelf: true,
  });
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;
  const body = (await request.json().catch(() => null)) as
    | { draft?: unknown }
    | null;

  if (!body || typeof body !== "object" || !("draft" in body)) {
    return NextResponse.json({ error: "Expected a draft object." }, { status: 400 });
  }

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .select("optimizer_draft")
    .eq("coach_id", coachId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json(
      { error: "Could not save profile draft." },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Import your LinkedIn profile first." },
      { status: 404 }
    );
  }

  const stored = normalizeOptimizerDraft(existing.optimizer_draft);
  const incoming = normalizeOptimizerDraft(body.draft);
  const now = new Date().toISOString();
  const next: ProfileOptimizerDraft = {
    ...incoming,
    copiedAt: incoming.copiedAt ?? stored.copiedAt,
    updatedAt: now,
  };

  const { error: saveError } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .update({ optimizer_draft: next, updated_at: now })
    .eq("coach_id", coachId);

  if (saveError) {
    return NextResponse.json(
      { error: "Could not save profile draft." },
      { status: 500 }
    );
  }

  return NextResponse.json({ draft: next });
}
