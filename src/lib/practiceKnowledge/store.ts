import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import { sanitizeBuiltSections } from "./blocks";
import { computeCompleteness } from "./completeness";
import {
  emptyPracticePayload,
  mergePracticePayload,
  normalizePracticePayload,
} from "./sourced";
import { mergePracticeIntoBrain } from "./syncBrain";
import type {
  BuiltSection,
  DecisionRecordPayload,
  DecisionRecordRow,
  IntakeAssetRow,
  IntakeSessionRow,
  InterviewTurn,
  PracticeKnowledgePayload,
  PracticeKnowledgeRow,
  PracticeReportPayload,
  PracticeStatus,
} from "./types";
import { PRACTICE_STATUSES } from "./types";

function isPracticeStatus(value: unknown): value is PracticeStatus {
  return (
    typeof value === "string" &&
    (PRACTICE_STATUSES as readonly string[]).includes(value)
  );
}

function mapKnowledgeRow(raw: Record<string, unknown>): PracticeKnowledgeRow {
  return {
    coach_id: String(raw.coach_id),
    status: isPracticeStatus(raw.status) ? raw.status : "capturing",
    payload: normalizePracticePayload(raw.payload),
    linkedin_seeded_at: (raw.linkedin_seeded_at as string | null) ?? null,
    form_completed_at: (raw.form_completed_at as string | null) ?? null,
    interview_completed_at: (raw.interview_completed_at as string | null) ?? null,
    coach_reviewed_at: (raw.coach_reviewed_at as string | null) ?? null,
    admin_reviewed_at: (raw.admin_reviewed_at as string | null) ?? null,
    completeness_score: Number(raw.completeness_score ?? 0),
    missing_fields: Array.isArray(raw.missing_fields)
      ? raw.missing_fields.map(String)
      : [],
    report_payload: (raw.report_payload as PracticeReportPayload | null) ?? null,
    report_generated_at: (raw.report_generated_at as string | null) ?? null,
    built_sections: sanitizeBuiltSections(raw.built_sections),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export async function ensurePracticeKnowledge(
  coachId: string
): Promise<PracticeKnowledgeRow> {
  const existing = await supabaseAdmin
    .from("coach_practice_knowledge")
    .select("*")
    .eq("coach_id", coachId)
    .maybeSingle();

  if (existing.data) {
    return mapKnowledgeRow(existing.data as Record<string, unknown>);
  }

  const payload = emptyPracticePayload();
  const completeness = computeCompleteness(payload);
  const inserted = await supabaseAdmin
    .from("coach_practice_knowledge")
    .insert({
      coach_id: coachId,
      payload,
      completeness_score: completeness.score,
      missing_fields: completeness.missing_fields,
    })
    .select("*")
    .single();

  if (inserted.error || !inserted.data) {
    const retry = await supabaseAdmin
      .from("coach_practice_knowledge")
      .select("*")
      .eq("coach_id", coachId)
      .maybeSingle();
    if (retry.data) {
      return mapKnowledgeRow(retry.data as Record<string, unknown>);
    }
    throw new Error(inserted.error?.message ?? "Could not create practice knowledge.");
  }
  return mapKnowledgeRow(inserted.data as Record<string, unknown>);
}

export async function patchPracticeKnowledge(opts: {
  coachId: string;
  payloadPatch?: Partial<PracticeKnowledgePayload>;
  status?: PracticeStatus;
  linkedinSeeded?: boolean;
  formCompleted?: boolean;
  interviewCompleted?: boolean;
  coachReviewed?: boolean;
  adminReviewed?: boolean;
  report?: PracticeReportPayload | null;
}): Promise<PracticeKnowledgeRow> {
  const current = await ensurePracticeKnowledge(opts.coachId);
  const payload = opts.payloadPatch
    ? mergePracticePayload(current.payload, opts.payloadPatch)
    : current.payload;
  const completeness = computeCompleteness(payload);
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    payload,
    completeness_score: completeness.score,
    missing_fields: completeness.missing_fields,
    updated_at: now,
  };
  if (opts.status) update.status = opts.status;
  if (opts.linkedinSeeded) update.linkedin_seeded_at = now;
  if (opts.formCompleted) update.form_completed_at = now;
  if (opts.interviewCompleted) update.interview_completed_at = now;
  if (opts.coachReviewed) update.coach_reviewed_at = now;
  if (opts.adminReviewed) update.admin_reviewed_at = now;
  if (opts.report !== undefined) {
    update.report_payload = opts.report;
    update.report_generated_at = opts.report ? now : null;
  }

  const { data, error } = await supabaseAdmin
    .from("coach_practice_knowledge")
    .update(update)
    .eq("coach_id", opts.coachId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update practice knowledge.");
  }
  return mapKnowledgeRow(data as Record<string, unknown>);
}

/**
 * Save one section BCA wrote. Reads the latest row first so sections built
 * one after another never overwrite each other. Pass null to remove it.
 */
export async function saveBuiltSection(opts: {
  coachId: string;
  key: string;
  section: BuiltSection | null;
}): Promise<PracticeKnowledgeRow> {
  const current = await ensurePracticeKnowledge(opts.coachId);
  const next = { ...current.built_sections };
  if (opts.section) next[opts.key] = opts.section;
  else delete next[opts.key];
  const { data, error } = await supabaseAdmin
    .from("coach_practice_knowledge")
    .update({ built_sections: sanitizeBuiltSections(next), updated_at: new Date().toISOString() })
    .eq("coach_id", opts.coachId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not save the section.");
  }
  return mapKnowledgeRow(data as Record<string, unknown>);
}

export async function syncPracticeToBrain(coachId: string): Promise<void> {
  const row = await ensurePracticeKnowledge(coachId);
  const prev = (await loadCoachAiContextRow(coachId)) ?? {};
  const next = mergePracticeIntoBrain(prev, row.payload);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ ai_context: next })
    .eq("id", coachId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getLatestIntakeSession(
  coachId: string
): Promise<IntakeSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("coach_intake_sessions")
    .select("*")
    .eq("coach_id", coachId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as IntakeSessionRow;
}

export async function getActiveIntakeSession(
  coachId: string
): Promise<IntakeSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("coach_intake_sessions")
    .select("*")
    .eq("coach_id", coachId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as IntakeSessionRow;
}

export async function createIntakeSession(
  coachId: string
): Promise<IntakeSessionRow> {
  const { data, error } = await supabaseAdmin
    .from("coach_intake_sessions")
    .insert({ coach_id: coachId, status: "active", turns: [] })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not start interview.");
  }
  return data as IntakeSessionRow;
}

export async function saveIntakeSession(opts: {
  sessionId: string;
  coachId: string;
  turns: InterviewTurn[];
  extraction: Partial<PracticeKnowledgePayload>;
  status?: "active" | "completed" | "abandoned";
}): Promise<IntakeSessionRow> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    turns: opts.turns,
    extraction: opts.extraction,
    updated_at: now,
  };
  if (opts.status) {
    update.status = opts.status;
    if (opts.status !== "active") {
      update.ended_at = now;
      const started = opts.turns[0]?.at;
      if (started) {
        update.duration_seconds = Math.max(
          0,
          Math.round((Date.parse(now) - Date.parse(started)) / 1000)
        );
      }
    }
  }
  const { data, error } = await supabaseAdmin
    .from("coach_intake_sessions")
    .update(update)
    .eq("id", opts.sessionId)
    .eq("coach_id", opts.coachId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not save interview.");
  }
  return data as IntakeSessionRow;
}

export async function listIntakeAssets(
  coachId: string
): Promise<IntakeAssetRow[]> {
  const { data, error } = await supabaseAdmin
    .from("coach_intake_assets")
    .select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IntakeAssetRow[];
}

export async function upsertDecisionRecord(opts: {
  coachId: string;
  payload: DecisionRecordPayload;
  lockedBy?: string | null;
  lock?: boolean;
}): Promise<DecisionRecordRow> {
  const existing = await supabaseAdmin
    .from("coach_decision_records")
    .select("*")
    .eq("coach_id", opts.coachId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    payload: opts.payload,
    updated_at: now,
  };
  if (opts.lock) {
    fields.locked_at = now;
    fields.locked_by = opts.lockedBy ?? null;
  }

  if (existing.data) {
    const { data, error } = await supabaseAdmin
      .from("coach_decision_records")
      .update(fields)
      .eq("id", (existing.data as { id: string }).id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not save record.");
    return data as DecisionRecordRow;
  }

  const { data, error } = await supabaseAdmin
    .from("coach_decision_records")
    .insert({
      coach_id: opts.coachId,
      ...fields,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save record.");
  return data as DecisionRecordRow;
}

export async function getLatestDecisionRecord(
  coachId: string
): Promise<DecisionRecordRow | null> {
  const { data, error } = await supabaseAdmin
    .from("coach_decision_records")
    .select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DecisionRecordRow | null) ?? null;
}
