import { NextResponse } from "next/server";

import { refreshAgentContextOverrides } from "@/lib/agent/agentOverrides";
import { brandFileFromAvaId, isAvaEditableFile, loadAvaCatalog } from "@/lib/agent/avaCatalog";
import { isRepoOnlyKnowledge } from "@/lib/agent/avaKnowledge";
import {
  getFileVersion,
  listFileVersions,
  liveFileSave,
  saveFileWithHistory,
  type FileStore,
} from "@/lib/agent/fileVersions";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

/** An Ava file id (agent/…, practice-skills/…, ai-knowledge/…) as its store and stored name. */
function storeFor(id: string | null | undefined): { store: FileStore; file: string } | null {
  const file = id?.trim();
  if (!file || !isAvaEditableFile(file) || isRepoOnlyKnowledge(file)) return null;
  const brandFile = brandFileFromAvaId(file);
  return brandFile ? { store: "brand", file: brandFile } : { store: "agent", file };
}

/** The last saves of one file, newest first, and who saved what is live now. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const target = storeFor(new URL(request.url).searchParams.get("file"));
  if (!target) return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  const [live, versions] = await Promise.all([
    liveFileSave(target.store, target.file),
    listFileVersions(target.store, target.file),
  ]);
  return NextResponse.json({ live, versions });
}

/** Restore: save an old version back. The version it replaces goes into the history. */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  let body: { file?: string; version?: number };
  try {
    body = (await request.json()) as { file?: string; version?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const target = storeFor(body.file);
  if (!target || typeof body.version !== "number") {
    return NextResponse.json({ error: "Unknown file or version." }, { status: 400 });
  }
  const content = await getFileVersion(target.store, target.file, body.version);
  if (content === null || !content.trim()) {
    return NextResponse.json({ error: "That version is gone." }, { status: 404 });
  }
  const { error } = await saveFileWithHistory({ ...target, content, userId: auth.userId });
  if (error) return NextResponse.json({ error }, { status: 500 });

  await refreshAgentContextOverrides();
  return NextResponse.json({ ok: true, catalog: await loadAvaCatalog() });
}
