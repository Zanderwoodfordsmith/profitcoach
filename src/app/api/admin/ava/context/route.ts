import { NextResponse } from "next/server";

import { refreshAgentContextOverrides } from "@/lib/agent/agentOverrides";
import { brandFileFromAvaId, isAvaEditableFile, loadAvaCatalog } from "@/lib/agent/avaCatalog";
import { isRepoOnlyKnowledge } from "@/lib/agent/avaKnowledge";
import { resetFileWithHistory, saveFileWithHistory } from "@/lib/agent/fileVersions";
import { isBrandKnowledgeFile } from "@/lib/profitCoachAi/brandKnowledge";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  return NextResponse.json(await loadAvaCatalog());
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  let body: { file?: string; content?: string };
  try {
    body = (await request.json()) as { file?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const file = body.file?.trim();
  if (!file || !isAvaEditableFile(file) || isRepoOnlyKnowledge(file)) {
    return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "Content cannot be empty." }, { status: 400 });
  }

  const brandFile = brandFileFromAvaId(file);
  if (brandFile && !isBrandKnowledgeFile(brandFile)) {
    return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  }
  const { error } = await saveFileWithHistory({
    store: brandFile ? "brand" : "agent",
    file: brandFile ?? file,
    content: body.content,
    userId: auth.userId,
  });
  if (error) return NextResponse.json({ error }, { status: 500 });

  await refreshAgentContextOverrides();
  return NextResponse.json({ ok: true, catalog: await loadAvaCatalog() });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const url = new URL(request.url);
  const file = url.searchParams.get("file")?.trim();
  if (!file || !isAvaEditableFile(file)) {
    return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  }

  const brandFile = brandFileFromAvaId(file);
  const { error } = await resetFileWithHistory(brandFile ? "brand" : "agent", brandFile ?? file);
  if (error) return NextResponse.json({ error }, { status: 500 });

  await refreshAgentContextOverrides();
  return NextResponse.json({ ok: true, catalog: await loadAvaCatalog() });
}
