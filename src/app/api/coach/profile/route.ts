import { NextResponse } from "next/server";
import { mergeCoachAiContext } from "@/lib/profitCoachAi/loadCoachPromptContext";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { geocodeLocation, reverseGeocodeLocation } from "@/lib/geocodeLocation";

async function requireCoach(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: effectiveId as string };
}

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  const impersonateHeader =
    request.headers.get("x-impersonate-coach-id")?.trim() ?? "";
  let account_email: string | null = null;
  if (impersonateHeader) {
    const { data: authUserData, error: authUserErr } =
      await supabaseAdmin.auth.admin.getUserById(coachId);
    if (!authUserErr) {
      account_email = authUserData?.user?.email ?? null;
    }
  }

  try {
    const profileResult = await supabaseAdmin
      .from("profiles")
      .select(
        "first_name, last_name, full_name, coach_business_name, avatar_url, linkedin_url, bio, location, ai_context, timezone, latitude, longitude, location_geocoded_source"
      )
      .eq("id", coachId)
      .maybeSingle();

    let profileRow: Record<string, unknown> | null =
      (profileResult.data as Record<string, unknown> | null);
    if (profileResult.error?.code === "42703") {
      let fallback = await supabaseAdmin
        .from("profiles")
        .select("full_name, coach_business_name, avatar_url, linkedin_url")
        .eq("id", coachId)
        .maybeSingle();
      if (fallback.error?.code === "42703") {
        fallback = await supabaseAdmin
          .from("profiles")
          .select("full_name, coach_business_name")
          .eq("id", coachId)
          .maybeSingle();
      }
      if (fallback.error) {
        return NextResponse.json(
          { error: "Could not load profile" },
          { status: 500 }
        );
      }
      profileRow = fallback.data as Record<string, unknown> | null;
    } else if (profileResult.error) {
      return NextResponse.json(
        { error: "Could not load profile" },
        { status: 500 }
      );
    }

    let coachRowResult = await supabaseAdmin
      .from("coaches")
      .select(
        "slug, directory_listed, directory_level, lead_webhook_url, calendar_embed_code"
      )
      .eq("id", coachId)
      .maybeSingle();
    let webhookColumnMissing = false;
    let calendarEmbedColumnMissing = false;
    if (coachRowResult.error?.code === "42703") {
      coachRowResult = await supabaseAdmin
        .from("coaches")
        .select("slug, directory_listed, directory_level, lead_webhook_url")
        .eq("id", coachId)
        .maybeSingle();
      calendarEmbedColumnMissing = true;
    }
    if (coachRowResult.error?.code === "42703") {
      coachRowResult = await supabaseAdmin
        .from("coaches")
        .select("slug, directory_listed, directory_level")
        .eq("id", coachId)
        .maybeSingle();
      webhookColumnMissing = true;
      calendarEmbedColumnMissing = true;
    }
    const { data: coachRow, error: coachErr } = coachRowResult;

    if (coachErr?.code === "42703") {
      const { data: fallbackCoach } = await supabaseAdmin
        .from("coaches")
        .select("slug")
        .eq("id", coachId)
        .maybeSingle();
      const slug = fallbackCoach?.slug ?? null;
      const prof = profileRow as {
        first_name?: string | null;
        last_name?: string | null;
        full_name?: string | null;
        coach_business_name?: string | null;
        avatar_url?: string | null;
        linkedin_url?: string | null;
        bio?: string | null;
        location?: string | null;
        ai_context?: CoachAiContext | null;
        timezone?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        location_geocoded_source?: string | null;
      } | null;

      return NextResponse.json({
        first_name: prof?.first_name ?? null,
        last_name: prof?.last_name ?? null,
        full_name: prof?.full_name ?? null,
        coach_business_name: prof?.coach_business_name ?? null,
        avatar_url: prof?.avatar_url ?? null,
        linkedin_url: prof?.linkedin_url ?? null,
        bio: prof?.bio ?? null,
        location: prof?.location ?? null,
        ai_context: prof?.ai_context ?? {},
        timezone: prof?.timezone ?? null,
        latitude: prof?.latitude ?? null,
        longitude: prof?.longitude ?? null,
        location_geocoded_source: prof?.location_geocoded_source ?? null,
        coach_slug: slug,
        directory_listed: false,
        directory_level: null,
        lead_webhook_url: null,
        calendar_embed_code: null,
        account_email,
      });
    }
    if (coachErr) {
      return NextResponse.json(
        { error: "Could not load profile" },
        { status: 500 }
      );
    }

    const slug = coachRow?.slug ?? null;
    const prof = profileRow as {
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
      coach_business_name?: string | null;
      avatar_url?: string | null;
      linkedin_url?: string | null;
      bio?: string | null;
      location?: string | null;
      ai_context?: CoachAiContext | null;
      timezone?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      location_geocoded_source?: string | null;
    } | null;

    return NextResponse.json({
      first_name: prof?.first_name ?? null,
      last_name: prof?.last_name ?? null,
      full_name: prof?.full_name ?? null,
      coach_business_name: prof?.coach_business_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      linkedin_url: prof?.linkedin_url ?? null,
      bio: prof?.bio ?? null,
      location: prof?.location ?? null,
      ai_context: prof?.ai_context ?? {},
      timezone: prof?.timezone ?? null,
      latitude: prof?.latitude ?? null,
      longitude: prof?.longitude ?? null,
      location_geocoded_source: prof?.location_geocoded_source ?? null,
      coach_slug: slug,
      directory_listed: coachRow?.directory_listed ?? false,
      directory_level: coachRow?.directory_level ?? null,
      lead_webhook_url: webhookColumnMissing
        ? null
        : (coachRow as { lead_webhook_url?: string | null } | null)
            ?.lead_webhook_url ?? null,
      calendar_embed_code: calendarEmbedColumnMissing
        ? null
        : (coachRow as { calendar_embed_code?: string | null } | null)
            ?.calendar_embed_code ?? null,
      account_email,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load profile" },
      { status: 500 }
    );
  }
}

type PatchBody = {
  first_name?: string | null;
  last_name?: string | null;
  coach_business_name?: string | null;
  linkedin_url?: string | null;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  /** IANA timezone id, e.g. Europe/London */
  timezone?: string | null;
  /** Place community-map pin manually (both required together). */
  map_latitude?: number | null;
  map_longitude?: number | null;
  /** Clear cached coordinates (map + geocoded). */
  clear_map_pin?: boolean;
  /** Partial merge into existing ai_context jsonb */
  ai_context?: Partial<CoachAiContext>;
  /** Coach may toggle directory visibility; level is admin-only. */
  directory_listed?: boolean;
  directory_level?: unknown;
  /**
   * Outbound webhook fired with prospect contact info + BOSS score. Admins
   * can also edit this via /api/admin/coaches/[id]; both paths feed the same
   * coaches.lead_webhook_url column.
   */
  lead_webhook_url?: string | null;
  /** Booking calendar embed HTML shown on post-assessment report page. */
  calendar_embed_code?: string | null;
};

export async function PATCH(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.directory_level !== undefined) {
    return NextResponse.json(
      { error: "Certification level can only be changed by an admin." },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.ai_context !== undefined) {
    if (body.ai_context === null || typeof body.ai_context !== "object") {
      return NextResponse.json(
        { error: "ai_context must be an object." },
        { status: 400 }
      );
    }
    const { data: curRow, error: curErr } = await supabaseAdmin
      .from("profiles")
      .select("ai_context")
      .eq("id", coachId)
      .maybeSingle();
    if (curErr?.code === "42703") {
      return NextResponse.json(
        {
          error:
            "ai_context is not available yet. Run the latest database migration.",
        },
        { status: 503 }
      );
    }
    const prev = ((curRow as { ai_context?: CoachAiContext } | null)?.ai_context ??
      {}) as CoachAiContext;
    updates.ai_context = mergeCoachAiContext(prev, body.ai_context);
  }

  if (body.first_name !== undefined) updates.first_name = body.first_name?.trim() ?? null;
  if (body.last_name !== undefined) updates.last_name = body.last_name?.trim() ?? null;
  if (body.coach_business_name !== undefined)
    updates.coach_business_name = body.coach_business_name?.trim() ?? null;
  if (body.linkedin_url !== undefined)
    updates.linkedin_url = body.linkedin_url?.trim() || null;
  if (body.bio !== undefined) updates.bio = body.bio?.trim() ?? null;
  if (body.location !== undefined) updates.location = body.location?.trim() ?? null;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url || null;
  if (body.timezone !== undefined) {
    const tz = body.timezone?.trim() ?? "";
    updates.timezone = tz.length > 0 ? tz : null;
  }

  if (body.clear_map_pin === true) {
    updates.latitude = null;
    updates.longitude = null;
    updates.location_geocoded_source = null;
    updates.location_geocoded_at = new Date().toISOString();
  }

  if (
    body.map_latitude !== undefined &&
    body.map_longitude !== undefined &&
    typeof body.map_latitude === "number" &&
    Number.isFinite(body.map_latitude) &&
    typeof body.map_longitude === "number" &&
    Number.isFinite(body.map_longitude)
  ) {
    if (
      body.map_latitude < -90 ||
      body.map_latitude > 90 ||
      body.map_longitude < -180 ||
      body.map_longitude > 180
    ) {
      return NextResponse.json(
        { error: "Map coordinates are out of range." },
        { status: 400 }
      );
    }
    updates.latitude = body.map_latitude;
    updates.longitude = body.map_longitude;
    updates.location_geocoded_source = "manual";
    updates.location_geocoded_at = new Date().toISOString();

    if (body.location === undefined) {
      const label = await reverseGeocodeLocation(
        body.map_latitude,
        body.map_longitude
      );
      if (label) {
        updates.location = label;
      }
    }
  }

  const coachUpdates: Record<string, unknown> = {};
  if (body.directory_listed !== undefined) {
    coachUpdates.directory_listed = !!body.directory_listed;
  }
  if (body.lead_webhook_url !== undefined) {
    if (body.lead_webhook_url === null) {
      coachUpdates.lead_webhook_url = null;
    } else if (typeof body.lead_webhook_url === "string") {
      const trimmed = body.lead_webhook_url.trim();
      if (trimmed === "") {
        coachUpdates.lead_webhook_url = null;
      } else if (!/^https?:\/\//i.test(trimmed)) {
        return NextResponse.json(
          { error: "Lead webhook URL must start with http:// or https://." },
          { status: 400 }
        );
      } else {
        coachUpdates.lead_webhook_url = trimmed;
      }
    } else {
      return NextResponse.json(
        { error: "lead_webhook_url must be a string or null." },
        { status: 400 }
      );
    }
  }
  if (body.calendar_embed_code !== undefined) {
    if (body.calendar_embed_code === null) {
      coachUpdates.calendar_embed_code = null;
    } else if (typeof body.calendar_embed_code === "string") {
      const trimmed = body.calendar_embed_code.trim();
      if (trimmed === "") {
        coachUpdates.calendar_embed_code = null;
      } else if (trimmed.length > 20000) {
        return NextResponse.json(
          { error: "Calendar embed code is too long." },
          { status: 400 }
        );
      } else {
        coachUpdates.calendar_embed_code = trimmed;
      }
    } else {
      return NextResponse.json(
        { error: "calendar_embed_code must be a string or null." },
        { status: 400 }
      );
    }
  }

  if (body.first_name !== undefined || body.last_name !== undefined) {
    const first = (body.first_name ?? "").trim();
    const last = (body.last_name ?? "").trim();
    updates.full_name =
      [first, last].filter(Boolean).join(" ").trim() || null;
  }

  if (
    Object.keys(updates).length === 0 &&
    Object.keys(coachUpdates).length === 0
  ) {
    return NextResponse.json({ ok: true });
  }

  if (Object.keys(coachUpdates).length > 0) {
    const coachRes = await supabaseAdmin
      .from("coaches")
      .update(coachUpdates)
      .eq("id", coachId);
    if (coachRes.error) {
      const includesWebhook = Object.prototype.hasOwnProperty.call(
        coachUpdates,
        "lead_webhook_url"
      );
      const includesCalendarEmbed = Object.prototype.hasOwnProperty.call(
        coachUpdates,
        "calendar_embed_code"
      );
      let msg: string;
      let status = 500;
      if (coachRes.error.code === "42703") {
        if (includesWebhook && includesCalendarEmbed) {
          msg =
            "Coach settings columns are missing. Deploy the latest database migrations.";
        } else if (includesWebhook) {
          msg =
            "Lead webhook column is missing. Deploy the latest database migration.";
        } else if (includesCalendarEmbed) {
          msg =
            "Calendar embed column is missing. Deploy the latest database migration.";
        } else {
          msg =
            "Coach settings require a database migration. Ask your team to deploy latest migrations.";
        }
      } else if (coachRes.error.code === "23514" && includesWebhook) {
        msg = "Lead webhook URL must be a valid http(s) URL.";
        status = 400;
      } else {
        msg =
          (coachRes.error as { message?: string }).message ??
          "Could not update directory settings";
      }
      return NextResponse.json({ error: msg }, { status });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Capture prior location + geocode source for smart re-geocode behaviour.
  let previousLocation: string | null = null;
  let previousGeoSource: string | null = null;
  if (body.location !== undefined) {
    const { data: prior } = await supabaseAdmin
      .from("profiles")
      .select("location, location_geocoded_source")
      .eq("id", coachId)
      .maybeSingle();
    previousLocation =
      (prior as { location?: string | null } | null)?.location ?? null;
    previousGeoSource =
      (prior as { location_geocoded_source?: string | null } | null)
        ?.location_geocoded_source ?? null;
  }

  let result = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", coachId);

  if (result.error?.code === "42703") {
    const minimalUpdates: Record<string, unknown> = {};
    if (updates.full_name !== undefined) minimalUpdates.full_name = updates.full_name;
    if (updates.coach_business_name !== undefined)
      minimalUpdates.coach_business_name = updates.coach_business_name;
    if (updates.avatar_url !== undefined) minimalUpdates.avatar_url = updates.avatar_url;
    if (Object.keys(minimalUpdates).length > 0) {
      result = await supabaseAdmin
        .from("profiles")
        .update(minimalUpdates)
        .eq("id", coachId);
    }
    if (result.error?.code === "42703" && minimalUpdates.avatar_url !== undefined) {
      delete minimalUpdates.avatar_url;
      if (Object.keys(minimalUpdates).length > 0) {
        result = await supabaseAdmin
          .from("profiles")
          .update(minimalUpdates)
          .eq("id", coachId);
      }
    }
  }

  if (result.error) {
    const message =
      result.error.code === "42703"
        ? "Some profile fields are not available yet. Run database migrations, or try saving only name and business."
        : (result.error as { message?: string }).message ?? "Could not update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Re-geocode when location actually changed. Failures must never break the save.
  if (body.location !== undefined) {
    const newLocation =
      typeof updates.location === "string" ? updates.location : null;
    const prev = (previousLocation ?? "").trim();
    const next = (newLocation ?? "").trim();
    if (prev !== next) {
      try {
        if (!next) {
          await supabaseAdmin
            .from("profiles")
            .update({
              latitude: null,
              longitude: null,
              location_geocoded_at: new Date().toISOString(),
              location_geocoded_source: null,
            })
            .eq("id", coachId);
        } else if (previousGeoSource === "manual") {
          // User placed a map pin: keep coordinates; location string is display-only.
        } else {
          const coords = await geocodeLocation(next);
          await supabaseAdmin
            .from("profiles")
            .update({
              latitude: coords?.lat ?? null,
              longitude: coords?.lng ?? null,
              location_geocoded_at: new Date().toISOString(),
              location_geocoded_source: coords ? "nominatim" : null,
            })
            .eq("id", coachId);
        }
      } catch (err) {
        // Geocoder columns may not exist if the migration hasn't run yet — log and move on.
        console.warn("profile geocode persist failed:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
