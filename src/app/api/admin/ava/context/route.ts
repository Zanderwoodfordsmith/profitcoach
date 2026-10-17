import { NextResponse } from "next/server";

import { refreshAgentContextOverrides } from "@/lib/agent/agentOverrides";
import {
  brandFileFromAvaId,
  buildAvaCatalog,
  isAvaEditableFile,
} from "@/lib/agent/avaCatalog";
import { isBrandKnowledgeFile } from "@/lib/profitCoachAi/brandKnowledge";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function loadOverrideMaps(): Promise<{
  overrides: Record<string, string>;
  updatedAt: Record<string, string>;
}> {
  const overrides: Record<string, string> = {};
  const updatedAt: Record<string, string> = {};

  const { data: agentRows } = await supabaseAdmin
    .from("agent_context_files")
    .select("file, content, updated_at");
  for (const row of agentRows ?? []) {
    if (typeof row.file !== "string" || typeof row.content !== "string") continue;
    overrides[row.file] = row.content;
    if (typeof row.updated_at === "string") updatedAt[row.file] = row.updated_at;
  }

  const { data: brandRows } = await supabaseAdmin
    .from("brand_knowledge_files")
    .select("file, content, updated_at");
  for (const row of brandRows ?? []) {
    if (typeof row.file !== "string" || typeof row.content !== "string") continue;
    const id = `ai-knowledge/${row.file}`;
    overrides[id] = row.content;
    if (typeof row.updated_at === "string") updatedAt[id] = row.updated_at;
  }

  return { overrides, updatedAt };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const maps = await loadOverrideMaps();
  return NextResponse.json(buildAvaCatalog(maps));
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
  if (!file || !isAvaEditableFile(file)) {
    return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "Content cannot be empty." }, { status: 400 });
  }

  const brandFile = brandFileFromAvaId(file);
  if (brandFile) {
    if (!isBrandKnowledgeFile(brandFile)) {
      return NextResponse.json({ error: "Unknown file." }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from("brand_knowledge_files").upsert({
      file: brandFile,
      content: body.content,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("agent_context_files").upsert({
      file,
      content: body.content,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await refreshAgentContextOverrides();
  const maps = await loadOverrideMaps();
  return NextResponse.json({ ok: true, catalog: buildAvaCatalog(maps) });
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
  const { error } = brandFile
    ? await supabaseAdmin.from("brand_knowledge_files").delete().eq("file", brandFile)
    : await supabaseAdmin.from("agent_context_files").delete().eq("file", file);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await refreshAgentContextOverrides();
  const maps = await loadOverrideMaps();
  return NextResponse.json({ ok: true, catalog: buildAvaCatalog(maps) });
}
