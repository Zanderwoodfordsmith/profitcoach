import { NextResponse } from "next/server";
import { requireShareCoach } from "@/lib/shareLinks/requireShareCoach";
import {
  normalizeSocialInput,
  parseSocialLinks,
  SOCIAL_NETWORKS,
  type SocialLinks,
  type SocialNetwork,
} from "@/lib/shareLinks/socials";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: Request) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    linkedin_url?: string | null;
    social_links?: Record<string, unknown>;
  };

  const profileUpdates: Record<string, unknown> = {};

  if (body.linkedin_url !== undefined) {
    const raw = (body.linkedin_url ?? "").trim();
    if (!raw) {
      profileUpdates.linkedin_url = null;
    } else {
      const parsed = normalizeSocialInput("linkedin", raw);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      profileUpdates.linkedin_url = parsed.url;
    }
  }

  if (body.social_links !== undefined) {
    if (!body.social_links || typeof body.social_links !== "object" || Array.isArray(body.social_links)) {
      return NextResponse.json({ error: "social_links must be an object." }, { status: 400 });
    }
    const next: SocialLinks = {};
    for (const key of SOCIAL_NETWORKS) {
      if (key === "linkedin") continue;
      const value = body.social_links[key];
      if (value === undefined) continue;
      const raw = typeof value === "string" ? value.trim() : "";
      if (!raw) continue;
      const parsed = normalizeSocialInput(key as SocialNetwork, raw);
      if (!parsed.ok) {
        return NextResponse.json(
          { error: `${key}: ${parsed.error}` },
          { status: 400 }
        );
      }
      next[key] = parsed.url;
    }
    profileUpdates.social_links = next;
  }

  if (Object.keys(profileUpdates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(profileUpdates)
    .eq("id", auth.coachId)
    .select("linkedin_url, social_links")
    .maybeSingle();

  if (error?.code === "42703") {
    return NextResponse.json(
      { error: "Social links are not available yet. Apply the latest database migration." },
      { status: 503 }
    );
  }
  if (error) {
    return NextResponse.json({ error: "Could not save socials." }, { status: 500 });
  }

  return NextResponse.json({
    linkedin_url: data?.linkedin_url ?? null,
    social_links: parseSocialLinks(data?.social_links),
  });
}
