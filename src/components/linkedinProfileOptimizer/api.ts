import { supabaseClient } from "@/lib/supabaseClient";
import type {
  ProfileOptimizerDraft,
  ProfileOptimizerPayload,
  ProfileOptimizerVariant,
  ProfileSectionId,
} from "@/lib/linkedinProfileOptimizer/types";
import type { LinkedInImportProfile } from "@/lib/linkedinProfileOptimizer/types";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

export async function optimizerHeaders(
  impersonatingCoachId?: string | null
): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
  if (impersonatingCoachId) {
    headers["x-impersonate-coach-id"] = impersonatingCoachId;
  }
  return headers;
}

async function request<T>(
  path: string,
  init: RequestInit | undefined,
  impersonatingCoachId?: string | null
): Promise<ApiResult<T>> {
  const headers = await optimizerHeaders(impersonatingCoachId);
  if (!headers) {
    return { ok: false, status: 401, data: null, error: "Not signed in." };
  }
  try {
    const res = await fetch(path, {
      ...init,
      headers: { ...headers, ...((init?.headers as Record<string, string>) ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as T & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error:
          body && typeof body === "object" && "error" in body && body.error
            ? String(body.error)
            : `Request failed (${res.status}).`,
      };
    }
    return { ok: true, status: res.status, data: body as T, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error." };
  }
}

export function getOptimizer(
  impersonatingCoachId?: string | null
): Promise<ApiResult<ProfileOptimizerPayload>> {
  return request("/api/coach/linkedin-profile", { method: "GET" }, impersonatingCoachId);
}

export function saveOptimizerDraft(
  draft: ProfileOptimizerDraft,
  impersonatingCoachId?: string | null
): Promise<ApiResult<{ draft: ProfileOptimizerDraft }>> {
  return request(
    "/api/coach/linkedin-profile",
    { method: "PATCH", body: JSON.stringify({ draft }) },
    impersonatingCoachId
  );
}

export function rewriteOptimizerSection(
  input: {
    section: ProfileSectionId;
    instruction?: string;
    experienceIndex?: number;
  },
  impersonatingCoachId?: string | null
): Promise<ApiResult<{ variants: ProfileOptimizerVariant[] }>> {
  return request(
    "/api/coach/linkedin-profile/rewrite",
    { method: "POST", body: JSON.stringify(input) },
    impersonatingCoachId
  );
}

export function importLinkedInProfile(
  linkedinUrl: string,
  impersonatingCoachId?: string | null
): Promise<ApiResult<{ profile: LinkedInImportProfile }>> {
  return request(
    "/api/coach/linkedin/profile",
    {
      method: "POST",
      body: JSON.stringify({ linkedinUrl: linkedinUrl.trim() || undefined }),
    },
    impersonatingCoachId
  );
}
