import "server-only";

import { createHash } from "node:crypto";

import {
  createHappyScribeJsonExport,
  createHappyScribeTranscription,
  configuredHappyScribeOrganizationId,
  downloadHappyScribeExport,
  getHappyScribeExport,
  getHappyScribeTranscription,
  listHappyScribeOrganizations,
  type HappyScribeTranscription,
} from "./client";
import { durationLabelToSeconds } from "./candidates";
import { happyScribeExportToTranscript } from "./transcript";
import {
  loadAcademyLessonContentRow,
  upsertAcademyLessonContent,
} from "@/lib/academy/lessonContent";
import {
  flattenLessonImportRows,
  type LessonImportStatusRow,
} from "@/lib/academy/lessonImportStatusClient";
import { loadLessonImportStatusReport } from "@/lib/academy/lessonImportStatus";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_BATCH_ITEMS = 100;
const MAX_TICK_ITEMS = 10;
const MAX_ATTEMPTS = 5;

type ContentRow = {
  course_id: string;
  lesson_id: string;
  video_url: string | null;
  transcript_text: string | null;
  duration: string | null;
  is_deleted: boolean | null;
};

export type TranscriptionCandidate = {
  key: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  kind: LessonImportStatusRow["kind"];
  parentLessonId: string | null;
  parentLessonTitle: string | null;
  sourceUrl: string;
  durationSeconds: number | null;
};

export type TranscriptionQueueItem = {
  id: string;
  runId: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string | null;
  kind: LessonImportStatusRow["kind"] | null;
  parentLessonId: string | null;
  parentLessonTitle: string | null;
  durationSeconds: number | null;
  status:
    | "pending"
    | "submitting"
    | "submitted"
    | "processing"
    | "exporting"
    | "imported"
    | "failed";
  providerTranscriptionId: string | null;
  providerExportId: string | null;
  attemptCount: number;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TranscriptionQueueRun = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  service: "auto" | "pro";
  language: string;
  requestedCount: number;
  completedCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: TranscriptionQueueItem[];
};

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function isProfitSystemLesson(row: LessonImportStatusRow): boolean {
  const id = row.lessonId.toLowerCase();
  return (
    id.startsWith("profit-brand-framework-") ||
    id.startsWith("profit-coach-os-") ||
    row.courseId === "profit-brand-framework" ||
    row.lessonTitle.toLowerCase().includes("profit system")
  );
}

function sourceFingerprint(sourceUrl: string): string {
  return createHash("sha256").update(sourceUrl).digest("hex");
}

export async function loadTranscriptionCandidates(): Promise<TranscriptionCandidate[]> {
  const report = await loadLessonImportStatusReport();
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("course_id, lesson_id, video_url, transcript_text, duration, is_deleted");
  if (error) throw new Error(error.message);

  const byKey = new Map<string, ContentRow>();
  for (const value of data ?? []) {
    const row = value as ContentRow;
    byKey.set(lessonKey(row.course_id, row.lesson_id), row);
  }

  return flattenLessonImportRows(report.lessons).flatMap((row) => {
    if (
      !row.missingTranscript ||
      !row.hasInAppVideo ||
      isProfitSystemLesson(row) ||
      row.lessonId.includes("#")
    ) {
      return [];
    }
    const canonicalCourseId = contentSourceCourseId(row.lessonId);
    const content = byKey.get(lessonKey(canonicalCourseId, row.lessonId));
    const sourceUrl = content?.video_url?.trim();
    if (!content || !sourceUrl || content.transcript_text?.trim() || content.is_deleted === true) {
      return [];
    }
    return [
      {
        key: lessonKey(canonicalCourseId, row.lessonId),
        courseId: canonicalCourseId,
        lessonId: row.lessonId,
        lessonTitle: row.lessonTitle,
        kind: row.kind,
        parentLessonId: row.parentLessonId ?? null,
        parentLessonTitle: row.parentLessonTitle ?? null,
        sourceUrl,
        durationSeconds: durationLabelToSeconds(content.duration),
      },
    ];
  });
}

function mapItem(value: Record<string, unknown>): TranscriptionQueueItem {
  const status = value.status;
  const validStatuses = new Set([
    "pending",
    "submitting",
    "submitted",
    "processing",
    "exporting",
    "imported",
    "failed",
  ]);
  return {
    id: String(value.id),
    runId: String(value.run_id),
    courseId: String(value.course_id),
    lessonId: String(value.lesson_id),
    lessonTitle: typeof value.lesson_title === "string" ? value.lesson_title : null,
    kind: typeof value.kind === "string" ? value.kind as TranscriptionQueueItem["kind"] : null,
    parentLessonId:
      typeof value.parent_lesson_id === "string" ? value.parent_lesson_id : null,
    parentLessonTitle:
      typeof value.parent_lesson_title === "string" ? value.parent_lesson_title : null,
    durationSeconds:
      typeof value.duration_seconds === "number" ? value.duration_seconds : null,
    status: validStatuses.has(String(status))
      ? (status as TranscriptionQueueItem["status"])
      : "failed",
    providerTranscriptionId:
      typeof value.provider_transcription_id === "string"
        ? value.provider_transcription_id
        : null,
    providerExportId:
      typeof value.provider_export_id === "string" ? value.provider_export_id : null,
    attemptCount: Number(value.attempt_count ?? 0),
    errorMessage: typeof value.error_message === "string" ? value.error_message : null,
    completedAt: typeof value.completed_at === "string" ? value.completed_at : null,
    createdAt: String(value.created_at),
    updatedAt: String(value.updated_at),
  };
}

async function loadItems(runIds: string[]): Promise<Map<string, TranscriptionQueueItem[]>> {
  if (runIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin
    .from("academy_transcription_items")
    .select(
      "id, run_id, course_id, lesson_id, lesson_title, kind, parent_lesson_id, parent_lesson_title, duration_seconds, status, provider_transcription_id, provider_export_id, attempt_count, error_message, completed_at, created_at, updated_at",
    )
    .in("run_id", runIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const grouped = new Map<string, TranscriptionQueueItem[]>();
  for (const value of data ?? []) {
    const item = mapItem(value as Record<string, unknown>);
    const items = grouped.get(item.runId) ?? [];
    items.push(item);
    grouped.set(item.runId, items);
  }
  return grouped;
}

export async function loadTranscriptionQueue(limit = 10): Promise<TranscriptionQueueRun[]> {
  const { data, error } = await supabaseAdmin
    .from("academy_transcription_runs")
    .select(
      "id, status, service, language, requested_count, completed_count, failed_count, error_message, started_at, finished_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw new Error(error.message);
  const runIds = (data ?? []).map((value) => String(value.id));
  const items = await loadItems(runIds);
  return (data ?? []).map((value) => {
    const row = value as Record<string, unknown>;
    return {
      id: String(row.id),
      status: row.status as TranscriptionQueueRun["status"],
      service: row.service as TranscriptionQueueRun["service"],
      language: String(row.language),
      requestedCount: Number(row.requested_count ?? 0),
      completedCount: Number(row.completed_count ?? 0),
      failedCount: Number(row.failed_count ?? 0),
      errorMessage: typeof row.error_message === "string" ? row.error_message : null,
      startedAt: typeof row.started_at === "string" ? row.started_at : null,
      finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      items: items.get(String(row.id)) ?? [],
    };
  });
}

export async function createTranscriptionBatch(input: {
  createdBy: string;
  keys?: string[];
  service?: "auto" | "pro";
  language?: string;
}): Promise<TranscriptionQueueRun> {
  const candidates = await loadTranscriptionCandidates();
  const byKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  const requestedKeys = input.keys?.length ? [...new Set(input.keys)] : candidates.map((c) => c.key);
  if (requestedKeys.length > MAX_BATCH_ITEMS) {
    throw new Error(`A batch may contain at most ${MAX_BATCH_ITEMS} items.`);
  }
  const selected = requestedKeys.flatMap((key) => {
    const candidate = byKey.get(key);
    return candidate ? [candidate] : [];
  });
  if (selected.length !== requestedKeys.length) {
    throw new Error("One or more selected lessons are no longer eligible.");
  }
  if (selected.length === 0) throw new Error("No missing video transcripts are eligible.");

  const now = new Date().toISOString();
  const { data: run, error: runError } = await supabaseAdmin
    .from("academy_transcription_runs")
    .insert({
      created_by: input.createdBy,
      service: input.service ?? "auto",
      language: input.language ?? "en",
      status: "pending",
      requested_count: selected.length,
      started_at: null,
      updated_at: now,
    })
    .select("id")
    .single();
  if (runError || !run?.id) throw new Error(runError?.message ?? "Could not create transcription run.");

  const { error: itemError } = await supabaseAdmin
    .from("academy_transcription_items")
    .insert(
      selected.map((candidate) => ({
        run_id: run.id,
        course_id: candidate.courseId,
        lesson_id: candidate.lessonId,
        lesson_title: candidate.lessonTitle,
        kind: candidate.kind,
        parent_lesson_id: candidate.parentLessonId,
        parent_lesson_title: candidate.parentLessonTitle,
        source_url: candidate.sourceUrl,
        source_fingerprint: sourceFingerprint(candidate.sourceUrl),
        duration_seconds: candidate.durationSeconds,
        status: "pending",
        updated_at: now,
      })),
    );
  if (itemError) {
    await supabaseAdmin.from("academy_transcription_runs").delete().eq("id", run.id);
    throw new Error(itemError.message);
  }
  const created = await loadTranscriptionQueue(10);
  const found = created.find((value) => value.id === run.id);
  if (!found) throw new Error("Could not load created transcription run.");
  return found;
}

async function updateItem(id: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin
    .from("academy_transcription_items")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function claimPendingItem(): Promise<Record<string, unknown> | null> {
  const { data: pending, error } = await supabaseAdmin
    .from("academy_transcription_items")
    .select("id, run_id, course_id, lesson_id, lesson_title, source_url, status, attempt_count")
    .eq("status", "pending")
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !pending) return null;
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("academy_transcription_items")
    .update({ status: "submitting", updated_at: new Date().toISOString() })
    .eq("id", pending.id)
    .eq("status", "pending")
    .select("id, run_id, course_id, lesson_id, lesson_title, source_url, status, attempt_count")
    .maybeSingle();
  if (claimError || !claimed) return null;
  return claimed as Record<string, unknown>;
}

async function organizationIdForRun(runId: string): Promise<number> {
  const { data: run, error } = await supabaseAdmin
    .from("academy_transcription_runs")
    .select("provider_organization_id")
    .eq("id", runId)
    .single();
  if (error) throw new Error(error.message);
  const configured = configuredHappyScribeOrganizationId();
  if (typeof run.provider_organization_id === "number") return run.provider_organization_id;
  if (configured) {
    await supabaseAdmin
      .from("academy_transcription_runs")
      .update({ provider_organization_id: configured, updated_at: new Date().toISOString() })
      .eq("id", runId);
    return configured;
  }
  const organizations = await listHappyScribeOrganizations();
  if (organizations.length !== 1) {
    throw new Error("Set HAPPYSCRIBE_ORGANIZATION_ID when Happy Scribe has multiple organizations.");
  }
  const organizationId = organizations[0].id;
  await supabaseAdmin
    .from("academy_transcription_runs")
    .update({ provider_organization_id: organizationId, updated_at: new Date().toISOString() })
    .eq("id", runId);
  return organizationId;
}

async function markRunRunning(runId: string): Promise<void> {
  await supabaseAdmin
    .from("academy_transcription_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["pending", "running"]);
}

async function submitItem(item: Record<string, unknown>): Promise<void> {
  const runId = String(item.run_id);
  await markRunRunning(runId);
  const { data: run, error: runError } = await supabaseAdmin
    .from("academy_transcription_runs")
    .select("service, language")
    .eq("id", runId)
    .single();
  if (runError || !run) throw new Error(runError?.message ?? "Transcription run not found.");
  const transcription = await createHappyScribeTranscription({
    organizationId: await organizationIdForRun(runId),
    name: String(item.lesson_title).slice(0, 500),
    sourceUrl: String(item.source_url),
    service: run.service === "pro" ? "pro" : "auto",
    language: typeof run.language === "string" ? run.language : "en",
    tag: `profit-coach-app:${String(item.id)}`,
  });
  await updateItem(String(item.id), {
    status: "submitted",
    provider_order_id: transcription.id,
    provider_transcription_id: transcription.id,
    attempt_count: Number(item.attempt_count ?? 0) + 1,
    error_message: null,
  });
}

async function writeTranscriptIfMissing(item: {
  id: string;
  courseId: string;
  lessonId: string;
  transcript: string;
}): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_content")
    .update({
      transcript_text: item.transcript.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("course_id", item.courseId)
    .eq("lesson_id", item.lessonId)
    .is("transcript_text", null)
    .select("lesson_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const current = await loadAcademyLessonContentRow(item.courseId, item.lessonId);
    if (!current?.transcript_text?.trim()) {
      await upsertAcademyLessonContent({
        courseId: item.courseId,
        lessonId: item.lessonId,
        transcriptText: item.transcript,
      });
    }
  }
}

async function processActiveItem(value: Record<string, unknown>): Promise<void> {
  const itemId = String(value.id);
  const transcriptionId =
    typeof value.provider_transcription_id === "string"
      ? value.provider_transcription_id
      : null;
  if (!transcriptionId) {
    await updateItem(itemId, {
      status: "failed",
      error_message: "Missing Happy Scribe transcription id.",
    });
    return;
  }
  const transcription: HappyScribeTranscription =
    await getHappyScribeTranscription(transcriptionId);
  if (transcription.state === "failed" || transcription.state === "locked") {
    await updateItem(itemId, {
      status: "failed",
      error_message: (transcription.failureMessage || transcription.failureReason || "Happy Scribe transcription failed.").slice(0, 2000),
    });
    return;
  }
  if (transcription.state !== "automatic_done") {
    await updateItem(itemId, { status: "processing", error_message: null });
    return;
  }

  let exportId =
    typeof value.provider_export_id === "string" ? value.provider_export_id : null;
  if (!exportId) {
    const created = await createHappyScribeJsonExport(transcriptionId);
    exportId = created.id;
    await updateItem(itemId, {
      status: created.state === "ready" ? "exporting" : "exporting",
      provider_export_id: exportId,
      error_message: null,
    });
    if (created.state !== "ready") return;
  }

  const exported = await getHappyScribeExport(exportId);
  if (exported.state === "failed" || exported.state === "expired") {
    await updateItem(itemId, {
      status: "failed",
      error_message: `Happy Scribe export ${exported.state}.`,
    });
    return;
  }
  if (exported.state !== "ready" || !exported.downloadLink) {
    await updateItem(itemId, { status: "exporting" });
    return;
  }

  const transcript = happyScribeExportToTranscript(
    await downloadHappyScribeExport(exported.downloadLink),
  );
  await writeTranscriptIfMissing({
    id: itemId,
    courseId: String(value.course_id),
    lessonId: String(value.lesson_id),
    transcript,
  });
  await updateItem(itemId, {
    status: "imported",
    completed_at: new Date().toISOString(),
    error_message: null,
  });
}

async function refreshRun(runId: string): Promise<void> {
  const { data: items, error } = await supabaseAdmin
    .from("academy_transcription_items")
    .select("status")
    .eq("run_id", runId);
  if (error) throw new Error(error.message);
  const rows = items ?? [];
  const completedCount = rows.filter((row) => row.status === "imported").length;
  const failedCount = rows.filter((row) => row.status === "failed").length;
  const allTerminal = rows.length > 0 && rows.every(
    (row) => row.status === "imported" || row.status === "failed",
  );
  const status = allTerminal ? (failedCount > 0 ? "failed" : "succeeded") : "running";
  await supabaseAdmin
    .from("academy_transcription_runs")
    .update({
      status,
      completed_count: completedCount,
      failed_count: failedCount,
      ...(allTerminal ? { finished_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["pending", "running"]);
}

export async function advanceTranscriptionQueue(limit = MAX_TICK_ITEMS): Promise<{
  checked: number;
  submitted: number;
  imported: number;
  failed: number;
  stillRunning: number;
}> {
  let checked = 0;
  let submitted = 0;
  let imported = 0;
  let failed = 0;
  const cappedLimit = Math.min(Math.max(limit, 1), MAX_TICK_ITEMS);

  for (let i = 0; i < cappedLimit; i += 1) {
    const item = await claimPendingItem();
    if (!item) break;
    checked += 1;
    try {
      await submitItem(item);
      submitted += 1;
    } catch (error) {
      await updateItem(String(item.id), {
        status: "failed",
        attempt_count: Number(item.attempt_count ?? 0) + 1,
        error_message: (error instanceof Error ? error.message : "Submission failed.").slice(0, 2000),
      });
      failed += 1;
    }
  }

  const { data: active, error } = await supabaseAdmin
    .from("academy_transcription_items")
    .select(
      "id, run_id, course_id, lesson_id, provider_transcription_id, provider_export_id, status, attempt_count",
    )
    .in("status", ["submitted", "processing", "exporting"])
    .order("updated_at", { ascending: true })
    .limit(cappedLimit);
  if (error) throw new Error(error.message);
  for (const value of active ?? []) {
    const before = value.status;
    try {
      await processActiveItem(value as Record<string, unknown>);
      const { data: after } = await supabaseAdmin
        .from("academy_transcription_items")
        .select("status")
        .eq("id", value.id)
        .single();
      if (before !== "imported" && after?.status === "imported") imported += 1;
      if (after?.status === "failed") failed += 1;
    } catch (error) {
      await updateItem(String(value.id), {
        status: "failed",
        error_message: (error instanceof Error ? error.message : "Processing failed.").slice(0, 2000),
      });
      failed += 1;
    }
  }

  const { data: runIds } = await supabaseAdmin
    .from("academy_transcription_items")
    .select("run_id")
    .in("status", ["pending", "submitting", "submitted", "processing", "exporting", "imported", "failed"]);
  for (const value of [...new Set((runIds ?? []).map((row) => String(row.run_id)))]) {
    await refreshRun(value);
  }

  const { count } = await supabaseAdmin
    .from("academy_transcription_items")
    .select("id", { count: "exact", head: true })
    .in("status", ["submitting", "submitted", "processing", "exporting"]);
  return {
    checked,
    submitted,
    imported,
    failed,
    stillRunning: count ?? 0,
  };
}

export async function retryTranscriptionItems(itemIds: string[]): Promise<number> {
  const ids = [...new Set(itemIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_BATCH_ITEMS);
  if (ids.length === 0) throw new Error("No failed transcription items selected.");
  const { data, error } = await supabaseAdmin
    .from("academy_transcription_items")
    .update({
      status: "pending",
      provider_transcription_id: null,
      provider_export_id: null,
      error_message: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .eq("status", "failed")
    .lt("attempt_count", MAX_ATTEMPTS)
    .select("id");
  if (error) throw new Error(error.message);
  const runIds = [...new Set((data ?? []).map((row) => String(row.id)))];
  if (runIds.length > 0) {
    const { data: runs } = await supabaseAdmin
      .from("academy_transcription_items")
      .select("run_id")
      .in("id", runIds);
    for (const run of runs ?? []) {
      await supabaseAdmin
        .from("academy_transcription_runs")
        .update({ status: "pending", finished_at: null, error_message: null, updated_at: new Date().toISOString() })
        .eq("id", run.run_id);
    }
  }
  return data?.length ?? 0;
}
