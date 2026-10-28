import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { handRoadmapJobToClaude } from "@/lib/roadmap/agent";

export const runtime = "nodejs";

/** Hand the card to Claude (or send it back): starts a cloud Claude session on it. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;
  try {
    const job = await handRoadmapJobToClaude(id);
    return NextResponse.json({ job });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn't start Claude.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
