import { NextResponse } from "next/server";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SYSTEM = `You write public directory copy for Profit Coach coaches.

Return ONLY one JSON object with this shape:
{
  "directory_summary": string,
  "directory_bio": string
}

Rules:
- directory_summary: 1–2 short sentences for a directory card (about 180–280 characters). Clear who they help and the outcome. No fluff, no hashtags.
- directory_bio: longer profile page bio (2–4 short paragraphs, or short paragraphs separated by blank lines). First person ("I"). Specific and credible. No markdown headings.
- Prefer LinkedIn snapshot facts (headline, about, recent roles, skills) when present.
- Use only facts from the coach context, LinkedIn snapshot, and notes. Do not invent awards, metrics, or clients.
- If notes/LinkedIn are thin, write a solid draft from what you have and stay humble.
- British or US English matching the coach's location/spelling when clear; otherwise clear international English.
- Never mention you are an AI or LinkedIn.`;

type DraftResult = {
  directory_summary?: string;
  directory_bio?: string;
};

function formatLinkedInSnapshot(snapshot: LinkedInProfileSnapshot): string {
  const lines: string[] = [];
  if (snapshot.fullName) lines.push(`Name: ${snapshot.fullName}`);
  if (snapshot.headline) lines.push(`Headline: ${snapshot.headline}`);
  if (snapshot.about) lines.push(`About:\n${snapshot.about}`);
  if (snapshot.location) lines.push(`Location: ${snapshot.location}`);
  if (snapshot.experiences?.length) {
    lines.push("Recent experience:");
    for (const exp of snapshot.experiences.slice(0, 5)) {
      const role = [exp.title, exp.company].filter(Boolean).join(" @ ");
      const when = [exp.start, exp.end || "present"].filter(Boolean).join(" – ");
      lines.push(`- ${role}${when ? ` (${when})` : ""}`);
      if (exp.description?.trim()) {
        lines.push(`  ${exp.description.trim().slice(0, 280)}`);
      }
    }
  }
  if (snapshot.skills?.length) {
    lines.push(`Skills: ${snapshot.skills.slice(0, 12).join(", ")}`);
  }
  return lines.join("\n") || "(empty snapshot)";
}

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    notes?: string;
  };
  const notes = body.notes?.trim() ?? "";

  const [{ data: profile, error: profileError }, { data: linkedInRow }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "first_name, last_name, full_name, coach_business_name, location, linkedin_url, community_bio, directory_summary, directory_bio"
        )
        .eq("id", auth.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("coach_linkedin_profiles")
        .select("linkedin_url, scraped_at, snapshot")
        .eq("coach_id", auth.userId)
        .maybeSingle(),
    ]);

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Could not load coach profile." },
      { status: 400 }
    );
  }

  const name =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    profile.full_name ||
    "Coach";

  const snapshot = (linkedInRow?.snapshot ?? null) as LinkedInProfileSnapshot | null;
  const linkedInBlock = snapshot
    ? `LinkedIn import (${linkedInRow?.scraped_at ?? "unknown date"}):\n${formatLinkedInSnapshot(snapshot)}`
    : "LinkedIn import: (none yet)";

  const userPrompt = [
    "Write directory_summary and directory_bio for this coach.",
    "",
    "Coach context:",
    `- Name: ${name}`,
    `- Business: ${profile.coach_business_name?.trim() || "(none)"}`,
    `- Location: ${profile.location?.trim() || "(none)"}`,
    `- LinkedIn URL: ${profile.linkedin_url?.trim() || "(none)"}`,
    `- Existing community bio (internal only — do not copy verbatim unless useful): ${
      profile.community_bio?.trim() || "(none)"
    }`,
    `- Current directory summary: ${
      profile.directory_summary?.trim() || "(empty)"
    }`,
    `- Current directory bio: ${profile.directory_bio?.trim() || "(empty)"}`,
    "",
    linkedInBlock,
    "",
    notes
      ? `Coach notes / what they want included:\n${notes}`
      : "Coach notes: (none — draft from LinkedIn and profile context.)",
  ].join("\n");

  const { data, error } = await generateCampaignJson<DraftResult>({
    system: SYSTEM,
    user: userPrompt,
    maxTokens: 2048,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Could not draft directory copy." },
      { status: 502 }
    );
  }

  const directory_summary = data.directory_summary?.trim() ?? "";
  const directory_bio = data.directory_bio?.trim() ?? "";
  if (!directory_summary && !directory_bio) {
    return NextResponse.json(
      { error: "Draft came back empty. Try adding a few notes and retry." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    directory_summary,
    directory_bio,
    usedLinkedIn: Boolean(snapshot),
  });
}
