import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LINKEDIN_PROFILE_SCRAPE_COOLDOWN_MS,
  LinkedInProfileError,
  normalizeLinkedInProfileUrl,
  scrapeLinkedInProfile,
  type LinkedInProfileSnapshot,
} from "@/lib/apify/linkedinProfile";
import { applyLinkedInPhotoAsAvatarIfMissing } from "@/lib/apify/applyLinkedInAvatar";

type StoredRow = {
  linkedin_url: string;
  scraped_at: string;
  snapshot: LinkedInProfileSnapshot;
};

async function callerIsAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) return false;
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  if (!user) return false;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.role === "admin";
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

  const { data, error } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .select("linkedin_url, scraped_at, snapshot")
    .eq("coach_id", authCheck.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Could not load LinkedIn profile snapshot." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ profile: null });
  }

  const row = data as StoredRow;
  return NextResponse.json({
    profile: {
      linkedinUrl: row.linkedin_url,
      scrapedAt: row.scraped_at,
      snapshot: row.snapshot,
    },
  });
}

export async function POST(request: Request) {
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
  const body = (await request.json().catch(() => ({}))) as {
    linkedinUrl?: string;
    force?: boolean;
  };

  let linkedinUrlInput = typeof body.linkedinUrl === "string" ? body.linkedinUrl.trim() : "";

  if (!linkedinUrlInput) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("linkedin_url")
      .eq("id", coachId)
      .maybeSingle();
    linkedinUrlInput = (profile?.linkedin_url as string | null)?.trim() ?? "";
  }

  if (!linkedinUrlInput) {
    return NextResponse.json(
      { error: "Add a LinkedIn profile URL first." },
      { status: 400 }
    );
  }

  const normalized = normalizeLinkedInProfileUrl(linkedinUrlInput);
  if (!normalized) {
    return NextResponse.json(
      { error: "Enter a valid LinkedIn profile URL (linkedin.com/in/…)." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .select("scraped_at, linkedin_url, snapshot")
    .eq("coach_id", coachId)
    .maybeSingle();

  const isAdmin = await callerIsAdmin(request);
  const force = Boolean(body.force) && isAdmin;

  if (existing?.scraped_at && !force) {
    const scrapedAt = new Date(existing.scraped_at as string).getTime();
    const elapsed = Date.now() - scrapedAt;
    if (Number.isFinite(scrapedAt) && elapsed < LINKEDIN_PROFILE_SCRAPE_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil(
        (LINKEDIN_PROFILE_SCRAPE_COOLDOWN_MS - elapsed) / 1000
      );
      return NextResponse.json(
        {
          error: `LinkedIn was imported recently. Try again in about ${Math.ceil(retryAfterSec / 60)} minute(s).`,
          retryAfterSec,
          profile: {
            linkedinUrl: existing.linkedin_url,
            scrapedAt: existing.scraped_at,
            snapshot: existing.snapshot,
          },
        },
        { status: 429 }
      );
    }
  }

  try {
    const result = await scrapeLinkedInProfile(normalized);
    const scrapedAt = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("coach_linkedin_profiles")
      .upsert(
        {
          coach_id: coachId,
          linkedin_url: result.linkedinUrl,
          scraped_at: scrapedAt,
          snapshot: result.snapshot,
          raw: result.raw,
          updated_at: scrapedAt,
        },
        { onConflict: "coach_id" }
      );

    if (upsertError) {
      return NextResponse.json(
        { error: "Imported LinkedIn data but failed to save it." },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("profiles")
      .update({ linkedin_url: result.linkedinUrl })
      .eq("id", coachId);

    const avatarResult = await applyLinkedInPhotoAsAvatarIfMissing(
      coachId,
      result.snapshot.photoUrl
    );
    if (avatarResult.status === "failed") {
      console.warn(
        `LinkedIn avatar import skipped for ${coachId}:`,
        avatarResult.error
      );
    }

    return NextResponse.json({
      profile: {
        linkedinUrl: result.linkedinUrl,
        scrapedAt,
        snapshot: result.snapshot,
      },
      avatar:
        avatarResult.status === "applied"
          ? { applied: true, avatarUrl: avatarResult.avatarUrl }
          : avatarResult.status === "skipped_has_avatar"
            ? { applied: false, reason: "already_has_avatar" as const }
            : avatarResult.status === "skipped_no_photo"
              ? { applied: false, reason: "no_photo" as const }
              : { applied: false, reason: "failed" as const },
    });
  } catch (err) {
    if (err instanceof LinkedInProfileError) {
      const status =
        err.code === "not_configured"
          ? 503
          : err.code === "invalid_url"
            ? 400
            : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("LinkedIn profile import failed:", err);
    return NextResponse.json(
      { error: "LinkedIn profile import failed." },
      { status: 502 }
    );
  }
}
