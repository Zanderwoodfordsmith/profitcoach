"use client";

import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { ApiResult } from "@/lib/firstCampaign/wizardApi";
import type {
  DecisionRecordRow,
  IntakeAssetRow,
  IntakeSessionRow,
  PracticeKnowledgePayload,
  PracticeKnowledgeRow,
  PracticeReportPayload,
  PracticeStatus,
} from "./types";

export type PracticeLoad = {
  knowledge: PracticeKnowledgeRow;
  assets: Array<IntakeAssetRow & { signed_url?: string | null }>;
  decision: DecisionRecordRow | null;
  coach_name?: string;
};

export type InterviewResponse = {
  knowledge: PracticeKnowledgeRow;
  session: IntakeSessionRow;
  assistant_message: string;
  done: boolean;
};

/**
 * Which coach the calls act as. Null uses the signed-in coach, or the admin's
 * "View as" coach. The admin Blueprint preview passes a coach explicitly so it
 * never touches the global "View as" setting.
 */
export type PracticeCoachId = string | null | undefined;

export function practiceHeaders(coachId?: PracticeCoachId) {
  return getCoachAuthHeaders(coachId ?? null);
}

async function request<T>(
  path: string,
  coachId: PracticeCoachId,
  init: { method: string; body?: unknown }
): Promise<ApiResult<T>> {
  const headers = await practiceHeaders(coachId);
  if (!headers) return { ok: false, status: 401, data: null, error: "Not signed in." };
  try {
    const res = await fetch(path, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: string } | null)?.error;
      return { ok: false, status: res.status, data: null, error: message || `Request failed (${res.status}).` };
    }
    return { ok: true, status: res.status, data: body as T, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error." };
  }
}

const get = <T,>(path: string, coachId: PracticeCoachId) => request<T>(path, coachId, { method: "GET" });
const post = <T,>(path: string, coachId: PracticeCoachId, body?: unknown) =>
  request<T>(path, coachId, { method: "POST", body });
const patch = <T,>(path: string, coachId: PracticeCoachId, body?: unknown) =>
  request<T>(path, coachId, { method: "PATCH", body });

export function loadPractice(coachId?: PracticeCoachId) {
  return get<PracticeLoad>("/api/coach/practice", coachId);
}

export function savePractice(
  body: {
    payload?: Partial<PracticeKnowledgePayload>;
    status?: PracticeStatus;
    form_completed?: boolean;
    coach_reviewed?: boolean;
    sync_brain?: boolean;
  },
  coachId?: PracticeCoachId
) {
  return patch<{ knowledge: PracticeKnowledgeRow }>("/api/coach/practice", coachId, body);
}

export function seedPracticeLinkedIn(coachId?: PracticeCoachId) {
  return post<{
    knowledge: PracticeKnowledgeRow;
    linkedin_summary: string;
    has_snapshot: boolean;
  }>("/api/coach/practice/seed-linkedin", coachId);
}

export function loadInterview(coachId?: PracticeCoachId) {
  return get<{ knowledge: PracticeKnowledgeRow; session: IntakeSessionRow | null }>(
    "/api/coach/practice/interview",
    coachId
  );
}

export function sendInterviewTurn(body: { message?: string; start?: boolean }, coachId?: PracticeCoachId) {
  return post<InterviewResponse>("/api/coach/practice/interview", coachId, body);
}

/** Write (or with clear, remove) one "We build" section. Takes up to a minute or two. */
export function buildPracticeSection(section: string, coachId?: PracticeCoachId, clear = false) {
  return post<{ knowledge: PracticeKnowledgeRow }>(
    "/api/coach/practice/build",
    coachId,
    clear ? { section, clear: true } : { section }
  );
}

/** Create a draft Get Clients campaign from the blueprint's campaign messaging. */
export function sendBlueprintCampaign(variant: "connector" | "conversation", coachId?: PracticeCoachId) {
  return post<{ campaign_id: string; name: string; steps: number }>(
    "/api/coach/practice/send-campaign",
    coachId,
    { variant }
  );
}

export function generatePracticeReport(coachId?: PracticeCoachId) {
  return post<{
    report: PracticeReportPayload | null;
    generated_at: string | null;
    knowledge: PracticeKnowledgeRow;
  }>("/api/coach/practice/report", coachId);
}

export async function uploadPracticeAsset(
  file: File,
  kind: string,
  coachId?: PracticeCoachId
): Promise<ApiResult<{ asset: IntakeAssetRow & { signed_url?: string | null } }>> {
  const headers = await practiceHeaders(coachId);
  if (!headers) return { ok: false, status: 401, data: null, error: "Not signed in." };
  // No Content-Type: the browser sets the multipart boundary.
  const { "Content-Type": _json, ...rest } = headers;
  void _json;
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  try {
    const res = await fetch("/api/coach/practice/assets", { method: "POST", headers: rest, body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: string } | null)?.error;
      return { ok: false, status: res.status, data: null, error: message || `Upload failed (${res.status}).` };
    }
    return { ok: true, status: res.status, data: body, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error." };
  }
}

export async function deletePracticeAsset(id: string, coachId?: PracticeCoachId) {
  const headers = await practiceHeaders(coachId);
  if (!headers) {
    return { ok: false, status: 401, data: null, error: "Not signed in." };
  }
  const res = await fetch(`/api/coach/practice/assets?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: (body as { error?: string } | null)?.error || "Could not delete.",
    };
  }
  return { ok: true, status: res.status, data: body, error: null };
}

export async function ttsAvailable(coachId?: PracticeCoachId) {
  const res = await get<{ available: boolean }>("/api/coach/practice/interview/tts", coachId);
  return Boolean(res.data?.available);
}

export async function speakInterviewText(text: string, coachId?: PracticeCoachId): Promise<Blob | null> {
  const headers = await practiceHeaders(coachId);
  if (!headers) return null;
  const res = await fetch("/api/coach/practice/interview/tts", {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return res.blob();
}
