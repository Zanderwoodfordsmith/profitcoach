import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { extractGhlCalendarIdFromEmbed } from "@/lib/extractGhlCalendarIdFromEmbed";
import { validateCrmLocationId } from "@/lib/ghlCalendarSync";
import { buildCoachCalendarSyncFields } from "@/lib/coachProfileCalendarSync";
import { syncCoachActionAutoComplete } from "@/lib/actionPlans/syncAutoComplete";
import { mergeCoachAiContext } from "@/lib/profitCoachAi/loadCoachPromptContext";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import { sanitizeLandingCopyOverrides } from "@/lib/landingCopy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { geocodeLocation, reverseGeocodeLocation } from "@/lib/geocodeLocation";

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
        "first_name, last_name, full_name, coach_business_name, avatar_url, linkedin_url, bio, community_bio, directory_summary, directory_bio, location, ai_context, timezone, latitude, longitude, location_geocoded_source, landing_copy_overrides, landing_variant_preference"
      )
      .eq("id", coachId)
      .maybeSingle();

    let profileRow: Record<string, unknown> | null =
      (profileResult.data as Record<string, unknown> | null);
    if (profileResult.error?.code === "42703") {
      let fallback = await supabaseAdmin
        .from("profiles")
        .select(
          "full_name, coach_business_name, avatar_url, linkedin_url, landing_copy_overrides, landing_variant_preference"
        )
        .eq("id", coachId)
        .maybeSingle();
      if (fallback.error?.code === "42703") {
        fallback = await supabaseAdmin
          .from("profiles")
          .select("full_name, coach_business_name, avatar_url, linkedin_url")
          .eq("id", coachId)
          .maybeSingle();
      }
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
        "slug, directory_listed, directory_level, lead_webhook_url, calendar_embed_code, crm_profile_name, crm_location_id, ghl_calendar_id"
      )
      .eq("id", coachId)
      .maybeSingle();
    let webhookColumnMissing = false;
    let calendarEmbedColumnMissing = false;
    let crmLocationColumnMissing = false;
    if (coachRowResult.error?.code === "42703") {
      coachRowResult = await supabaseAdmin
        .from("coaches")
        .select(
          "slug, directory_listed, directory_level, lead_webhook_url, calendar_embed_code"
        )
        .eq("id", coachId)
        .maybeSingle();
      crmLocationColumnMissing = true;
    }
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
        community_bio?: string | null;
        directory_summary?: string | null;
        directory_bio?: string | null;
        location?: string | null;
        ai_context?: CoachAiContext | null;
        timezone?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        location_geocoded_source?: string | null;
        landing_copy_overrides?: unknown;
        landing_variant_preference?: string | null;
      } | null;

      return NextResponse.json({
        first_name: prof?.first_name ?? null,
        last_name: prof?.last_name ?? null,
        full_name: prof?.full_name ?? null,
        coach_business_name: prof?.coach_business_name ?? null,
        avatar_url: prof?.avatar_url ?? null,
        linkedin_url: prof?.linkedin_url ?? null,
        bio: prof?.bio ?? null,
        community_bio: prof?.community_bio ?? null,
        directory_summary: prof?.directory_summary ?? null,
        directory_bio: prof?.directory_bio ?? null,
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
        landing_copy_overrides: sanitizeLandingCopyOverrides(
          prof?.landing_copy_overrides
        ),
        landing_variant_preference:
          prof?.landing_variant_preference === "a" ||
          prof?.landing_variant_preference === "b" ||
          prof?.landing_variant_preference === "c" ||
          prof?.landing_variant_preference === "d"
            ? prof.landing_variant_preference
            : null,
        account_email,
        ...buildCoachCalendarSyncFields(null),
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
      community_bio?: string | null;
      directory_summary?: string | null;
      directory_bio?: string | null;
      location?: string | null;
      ai_context?: CoachAiContext | null;
      timezone?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      location_geocoded_source?: string | null;
      landing_copy_overrides?: unknown;
      landing_variant_preference?: string | null;
    } | null;

    return NextResponse.json({
      first_name: prof?.first_name ?? null,
      last_name: prof?.last_name ?? null,
      full_name: prof?.full_name ?? null,
      coach_business_name: prof?.coach_business_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      linkedin_url: prof?.linkedin_url ?? null,
      bio: prof?.bio ?? null,
      community_bio: prof?.community_bio ?? null,
      directory_summary: prof?.directory_summary ?? null,
      directory_bio: prof?.directory_bio ?? null,
      location: prof?.location ?? null,
      ai_context: prof?.ai_context ?? {},
      timezone: prof?.timezone ?? null,
      latitude: prof?.latitude ?? null,
      longitude: prof?.longitude ?? null,
      location_geocoded_source: prof?.location_geocoded_source ?? null,
      coach_slug: slug,
      crm_profile_name: crmLocationColumnMissing
        ? null
        : (coachRow as { crm_profile_name?: string | null } | null)
            ?.crm_profile_name ?? null,
      crm_location_id: crmLocationColumnMissing
        ? null
        : (coachRow as { crm_location_id?: string | null } | null)
            ?.crm_location_id ?? null,
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
      landing_copy_overrides: sanitizeLandingCopyOverrides(
        prof?.landing_copy_overrides
      ),
      landing_variant_preference:
        prof?.landing_variant_preference === "a" ||
        prof?.landing_variant_preference === "b" ||
        prof?.landing_variant_preference === "c" ||
        prof?.landing_variant_preference === "d"
          ? prof.landing_variant_preference
          : null,
      account_email,
      ...buildCoachCalendarSyncFields(
        crmLocationColumnMissing
          ? {
              calendar_embed_code: calendarEmbedColumnMissing
                ? null
                : (coachRow as { calendar_embed_code?: string | null } | null)
                    ?.calendar_embed_code ?? null,
            }
          : (coachRow as {
              calendar_embed_code?: string | null;
              crm_location_id?: string | null;
              ghl_calendar_id?: string | null;
            } | null)
      ),
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
  community_bio?: string | null;
  directory_summary?: string | null;
  directory_bio?: string | null;
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
  /** Allowlisted keys only; sanitized server-side (see landingCopy.ts). */
  landing_copy_overrides?: Record<string, unknown> | null;
  /** Reserved for future funnel routing; /score currently always opens landing D. */
  landing_variant_preference?: "a" | "b" | "c" | "d" | null;
  slug?: string | null;
  crm_profile_name?: string | null;
  crm_location_id?: string | null;
};

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
  if (body.community_bio !== undefined)
    updates.community_bio = body.community_bio?.trim() ?? null;
  if (body.directory_summary !== undefined)
    updates.directory_summary = body.directory_summary?.trim() ?? null;
  if (body.directory_bio !== undefined)
    updates.directory_bio = body.directory_bio?.trim() ?? null;
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
  if (body.slug !== undefined) {
    if (body.slug === null || body.slug === "") {
      return NextResponse.json(
        { error: "Slug is required." },
        { status: 400 }
      );
    }
    if (typeof body.slug !== "string") {
      return NextResponse.json(
        { error: "slug must be a string." },
        { status: 400 }
      );
    }
    const normalized = body.slug.toLowerCase().trim();
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      return NextResponse.json(
        {
          error:
            "Slug can only contain lowercase letters, numbers, and hyphens.",
        },
        { status: 400 }
      );
    }
    coachUpdates.slug = normalized;
  }
  if (body.crm_profile_name !== undefined) {
    if (body.crm_profile_name === null || body.crm_profile_name === "") {
      coachUpdates.crm_profile_name = null;
    } else if (typeof body.crm_profile_name === "string") {
      coachUpdates.crm_profile_name = body.crm_profile_name.trim();
    } else {
      return NextResponse.json(
        { error: "crm_profile_name must be a string or null." },
        { status: 400 }
      );
    }
  }
  if (body.crm_location_id !== undefined) {
    if (body.crm_location_id === null || body.crm_location_id === "") {
      coachUpdates.crm_location_id = null;
    } else if (typeof body.crm_location_id === "string") {
      const validated = validateCrmLocationId(body.crm_location_id);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      coachUpdates.crm_location_id = validated.value;
    } else {
      return NextResponse.json(
        { error: "crm_location_id must be a string or null." },
        { status: 400 }
      );
    }
  }
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
      coachUpdates.ghl_calendar_id = null;
    } else if (typeof body.calendar_embed_code === "string") {
      const trimmed = body.calendar_embed_code.trim();
      if (trimmed === "") {
        coachUpdates.calendar_embed_code = null;
        coachUpdates.ghl_calendar_id = null;
      } else if (trimmed.length > 20000) {
        return NextResponse.json(
          { error: "Calendar embed code is too long." },
          { status: 400 }
        );
      } else {
        coachUpdates.calendar_embed_code = trimmed;
        coachUpdates.ghl_calendar_id = extractGhlCalendarIdFromEmbed(trimmed);
      }
    } else {
      return NextResponse.json(
        { error: "calendar_embed_code must be a string or null." },
        { status: 400 }
      );
    }
  }

  if (body.landing_copy_overrides !== undefined) {
    if (body.landing_copy_overrides === null) {
      updates.landing_copy_overrides = {};
    } else if (
      typeof body.landing_copy_overrides === "object" &&
      !Array.isArray(body.landing_copy_overrides)
    ) {
      updates.landing_copy_overrides = sanitizeLandingCopyOverrides(
        body.landing_copy_overrides
      );
    } else {
      return NextResponse.json(
        { error: "landing_copy_overrides must be an object or null." },
        { status: 400 }
      );
    }
  }

  if (body.landing_variant_preference !== undefined) {
    const v = body.landing_variant_preference;
    if (v === null) {
      updates.landing_variant_preference = null;
    } else if (v === "a" || v === "b" || v === "c" || v === "d") {
      updates.landing_variant_preference = v;
    } else {
      return NextResponse.json(
        { error: "landing_variant_preference must be a, b, c, d, or null." },
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

    let coachUpdateError = coachRes.error;
    if (
      coachUpdateError?.code === "42703" &&
      Object.prototype.hasOwnProperty.call(coachUpdates, "ghl_calendar_id")
    ) {
      const { ghl_calendar_id: _dropped, ...withoutGhlCalendarId } =
        coachUpdates;
      const retry = await supabaseAdmin
        .from("coaches")
        .update(withoutGhlCalendarId)
        .eq("id", coachId);
      coachUpdateError = retry.error;
    }

    if (coachUpdateError) {
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
      if (coachUpdateError.code === "42703") {
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
      } else if (coachUpdateError.code === "23514" && includesWebhook) {
        msg = "Lead webhook URL must be a valid http(s) URL.";
        status = 400;
      } else if (coachUpdateError.code === "23505") {
        msg = "That slug is already in use. Please choose another.";
        status = 400;
      } else {
        msg =
          (coachUpdateError as { message?: string }).message ??
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
    if (updates.landing_copy_overrides !== undefined)
      minimalUpdates.landing_copy_overrides = updates.landing_copy_overrides;
    if (updates.landing_variant_preference !== undefined)
      minimalUpdates.landing_variant_preference = updates.landing_variant_preference;
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

  const autoCompleteFieldsChanged =
    body.calendar_embed_code !== undefined ||
    body.lead_webhook_url !== undefined ||
    body.crm_profile_name !== undefined ||
    body.crm_location_id !== undefined;
  if (autoCompleteFieldsChanged) {
    try {
      await syncCoachActionAutoComplete(coachId);
    } catch (syncErr) {
      console.warn("coach/profile auto-complete sync failed:", syncErr);
    }
  }

  return NextResponse.json({ ok: true });
}
