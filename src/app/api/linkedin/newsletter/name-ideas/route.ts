import { NextResponse } from "next/server";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { loadNewsletterBrainBundle } from "@/lib/linkedinNewsletter/loadBrainContext";
import {
  NAME_IDEAS_SYSTEM,
  buildNameIdeasUser,
} from "@/lib/linkedinNewsletter/prompts";

export async function POST(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const brain = await loadNewsletterBrainBundle(auth.userId);
  const { data, error } = await generateCampaignJson<{
    ideas?: string[];
    taglines?: string[];
  }>({
    system: NAME_IDEAS_SYSTEM,
    user: buildNameIdeasUser(brain),
    maxTokens: 2048,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Failed to suggest names." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ideas: (data.ideas ?? []).map((x) => String(x).trim()).filter(Boolean),
    taglines: (data.taglines ?? []).map((x) => String(x).trim()).filter(Boolean),
  });
}
