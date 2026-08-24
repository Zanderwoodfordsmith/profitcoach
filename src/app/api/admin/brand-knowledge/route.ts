import { NextResponse } from "next/server";

import {
  BRAND_KNOWLEDGE_FILES,
  isBrandKnowledgeFile,
  loadBrandKnowledgeOverrides,
  readBrandKnowledgeRepoFile,
} from "@/lib/profitCoachAi/brandKnowledge";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const overrides = await loadBrandKnowledgeOverrides();
  const { data: rows } = await supabaseAdmin
    .from("brand_knowledge_files")
    .select("file, updated_at");
  const updatedAt = new Map(
    (rows ?? []).map((r) => [r.file as string, r.updated_at as string])
  );

  const files = BRAND_KNOWLEDGE_FILES.map((meta) => {
    const override = overrides[meta.file];
    const repo = readBrandKnowledgeRepoFile(meta.file);
    return {
      ...meta,
      content: override ?? repo ?? "",
      overridden: override !== undefined,
      updated_at: updatedAt.get(meta.file) ?? null,
      missing: repo === null && override === undefined,
    };
  });

  return NextResponse.json({ files });
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
  if (!file || !isBrandKnowledgeFile(file)) {
    return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json(
      { error: "Content cannot be empty." },
      { status: 400 }
    );
  }
  const { error } = await supabaseAdmin.from("brand_knowledge_files").upsert({
    file,
    content: body.content,
    updated_at: new Date().toISOString(),
    updated_by: auth.userId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Remove the override — file falls back to the repo version. */
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const url = new URL(request.url);
  const file = url.searchParams.get("file")?.trim();
  if (!file || !isBrandKnowledgeFile(file)) {
    return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("brand_knowledge_files")
    .delete()
    .eq("file", file);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
