import { NextResponse } from "next/server";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { loadNewsletterBrainBundle } from "@/lib/linkedinNewsletter/loadBrainContext";
import { TOPIC_IDEAS_SYSTEM } from "@/lib/linkedinNewsletter/prompts";

export async function POST(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const brain = await loadNewsletterBrainBundle(auth.userId);
  const { data, error } = await generateCampaignJson<{
    topics?: Array<{ title?: string; angle?: string; why?: string }>;
  }>({
    system: TOPIC_IDEAS_SYSTEM,
    user: [
      "Suggest 10 newsletter topics.",
      "",
      "## Coach AI brain",
      brain.brainText,
      "",
      "## Client questions / pains",
      brain.painLines.length
        ? brain.painLines.map((p) => `- ${p}`).join("\n")
        : "(none listed — invent likely recurring questions for this ICP)",
      "",
      "## Messaging hooks",
      brain.avatarHooks.length
        ? brain.avatarHooks.map((h) => `- ${h}`).join("\n")
        : "(none)",
      "",
      "Use: client questions, myths, deepen top angles, timely POV.",
    ].join("\n"),
    maxTokens: 3072,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Failed to suggest topics." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    topics: (data.topics ?? [])
      .map((t) => ({
        title: String(t.title ?? "").trim(),
        angle: String(t.angle ?? "").trim(),
        why: String(t.why ?? "").trim(),
      }))
      .filter((t) => t.title),
  });
}
