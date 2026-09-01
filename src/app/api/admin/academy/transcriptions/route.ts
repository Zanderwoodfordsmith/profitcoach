import { NextResponse } from "next/server";

import {
  createTranscriptionBatch,
  loadTranscriptionCandidates,
  loadTranscriptionQueue,
} from "@/lib/happyScribe/queue";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

function publicCandidate(candidate: Awaited<ReturnType<typeof loadTranscriptionCandidates>>[number]) {
  return {
    key: candidate.key,
    courseId: candidate.courseId,
    lessonId: candidate.lessonId,
    lessonTitle: candidate.lessonTitle,
    kind: candidate.kind,
    parentLessonId: candidate.parentLessonId,
    parentLessonTitle: candidate.parentLessonTitle,
    durationSeconds: candidate.durationSeconds,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "Server error." ? 500 : 401 },
    );
  }
  try {
    const [candidates, runs] = await Promise.all([
      loadTranscriptionCandidates(),
      loadTranscriptionQueue(),
    ]);
    return NextResponse.json({
      candidates: candidates.map(publicCandidate),
      runs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load transcription queue." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "Server error." ? 500 : 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    keys?: unknown;
    service?: unknown;
    language?: unknown;
    dryRun?: unknown;
  };
  const keys =
    body.keys === undefined
      ? undefined
      : Array.isArray(body.keys) &&
          body.keys.every((value) => typeof value === "string")
        ? body.keys.map((value) => value.trim()).filter(Boolean)
        : null;
  if (keys === null) {
    return NextResponse.json({ error: "keys must be an array of lesson keys." }, { status: 400 });
  }
  const service = body.service === undefined ? "auto" : body.service;
  const language = body.language === undefined ? "en" : body.language;
  if (service !== "auto" && service !== "pro") {
    return NextResponse.json({ error: "Only auto or pro transcription is supported." }, { status: 400 });
  }
  if (language !== "en") {
    return NextResponse.json({ error: "Only English transcription is supported." }, { status: 400 });
  }

  try {
    const candidates = await loadTranscriptionCandidates();
    if (body.dryRun === true) {
      return NextResponse.json({
        dryRun: true,
        count: candidates.length,
        candidates: candidates.map(publicCandidate),
      });
    }
    const run = await createTranscriptionBatch({
      createdBy: auth.userId,
      keys: keys ?? undefined,
      service,
      language,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create transcription batch.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
