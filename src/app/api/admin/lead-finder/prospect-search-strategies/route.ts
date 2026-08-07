import { NextResponse } from "next/server";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { requireLeadFinderAccess } from "@/lib/requireLeadFinderAccess";
import { loadProspectSearchAvatarContext } from "@/lib/salesNavigator/prospectSearch/loadAvatarContext";
import { normalizeProspectSearchStrategies } from "@/lib/salesNavigator/prospectSearch/normalizeStrategies";
import {
  PROSPECT_SEARCH_STRATEGIES_SYSTEM,
  buildProspectSearchStrategiesUser,
} from "@/lib/salesNavigator/prospectSearch/prompts";
import type { ProspectSearchStrategiesRequest } from "@/lib/salesNavigator/prospectSearch/types";

export async function POST(request: Request) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: auth.error === "Not authorized." ? 403 : 401 }
    );
  }

  let body: ProspectSearchStrategiesRequest;
  try {
    body = (await request.json()) as ProspectSearchStrategiesRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const useBrain = body.useBrainAvatar !== false;
  const avatarCtx = useBrain
    ? await loadProspectSearchAvatarContext(auth.userId)
    : { industryHint: null, avatarSummary: null, source: null };

  const industry =
    body.industry?.trim() || avatarCtx.industryHint?.trim() || "";
  if (!industry) {
    return NextResponse.json(
      {
        error:
          "Describe the ideal avatar / industry, or set one in First Campaign / AI brain first.",
      },
      { status: 400 }
    );
  }

  const input: ProspectSearchStrategiesRequest & {
    industry: string;
    avatarSummary?: string | null;
  } = {
    industry,
    location: body.location?.trim() || null,
    notes: body.notes?.trim() || null,
    sampleProfileNotes: body.sampleProfileNotes?.trim() || null,
    avatarSummary: avatarCtx.avatarSummary,
  };

  const { data, error } = await generateCampaignJson<unknown>({
    system: PROSPECT_SEARCH_STRATEGIES_SYSTEM,
    user: buildProspectSearchStrategiesUser(input),
    maxTokens: 4096,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Could not generate search strategies." },
      { status: 502 }
    );
  }

  const result = normalizeProspectSearchStrategies(data, industry);
  if (!result) {
    return NextResponse.json(
      { error: "Model returned an empty or invalid strategy set." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ...result,
    usedBrainSource: avatarCtx.source,
  });
}
