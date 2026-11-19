import { NextResponse } from "next/server";

import { resolveCoachByRef } from "@/lib/admin/resolveCoachRef";
import {
  SOURCES_BUCKET,
  addCoachSource,
  listCoachSources,
  removeCoachSource,
  transcribeStoredFile,
  uploadPath,
} from "@/lib/practiceKnowledge/coachSources";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Long voice notes and videos take a while to transcribe. */
export const maxDuration = 300;

async function guard(request: Request, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.error === "Server error." ? 500 : 401 }) };
  }
  const { slug } = await context.params;
  const coach = slug?.trim() ? await resolveCoachByRef(slug) : null;
  if (!coach) return { error: NextResponse.json({ error: "Coach not found." }, { status: 404 }) };
  return { coachId: coach.id, adminId: auth.userId };
}

/** Everything Ava reads for this coach's Blueprint. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const ctx = await guard(request, context);
  if ("error" in ctx) return ctx.error;
  try {
    return NextResponse.json({ sources: await listCoachSources(ctx.coachId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load sources." }, { status: 500 });
  }
}

/**
 * { action: "upload", fileName } → a signed upload slot for the browser.
 * { title, date, text } or { title, date, filePath } → saves a source; a file is transcribed first.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const ctx = await guard(request, context);
  if ("error" in ctx) return ctx.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  if (body.action === "upload") {
    const fileName = typeof body.fileName === "string" ? body.fileName : "file";
    const path = uploadPath(ctx.coachId, fileName);
    const { data, error } = await supabaseAdmin.storage.from(SOURCES_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Couldn't start the upload." }, { status: 500 });
    return NextResponse.json({ path, token: data.token });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? `${body.date}T12:00:00Z` : null;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const filePath = typeof body.filePath === "string" ? body.filePath : "";
  if (!title) return NextResponse.json({ error: "Give it a title." }, { status: 400 });
  if (filePath && !filePath.startsWith(`${ctx.coachId}/`)) {
    return NextResponse.json({ error: "That file belongs to another coach." }, { status: 400 });
  }
  if (!text && !filePath) return NextResponse.json({ error: "Paste some text or upload a file." }, { status: 400 });

  try {
    const transcript = filePath ? await transcribeStoredFile(filePath) : text;
    await addCoachSource({
      coachId: ctx.coachId,
      addedBy: ctx.adminId,
      title,
      calledAt: date ?? new Date().toISOString(),
      body: transcript,
      filePath: filePath || null,
    });
    return NextResponse.json({ sources: await listCoachSources(ctx.coachId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save it." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  const ctx = await guard(request, context);
  if ("error" in ctx) return ctx.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    await removeCoachSource(ctx.coachId, id);
    return NextResponse.json({ sources: await listCoachSources(ctx.coachId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't remove it." }, { status: 500 });
  }
}
