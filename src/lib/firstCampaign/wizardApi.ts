"use client";

/** First Campaign Setup wizard — client-side API helpers. */

import { supabaseClient } from "@/lib/supabaseClient";
import type { CampaignMessageDraft } from "@/lib/firstCampaign/types";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import {
  EMPTY_CAMPAIGN_STATE,
  normalizeCampaignSetupFromApi,
  type AvatarState,
  type CampaignSetupState,
  type ChosenIcp,
  type LeadListSummary,
  type MessagesState,
} from "@/lib/firstCampaign/mapApi";

export type LinkedInImportProfile = {
  linkedinUrl: string;
  scrapedAt: string;
  snapshot: LinkedInProfileSnapshot;
};

export {
  EMPTY_CAMPAIGN_STATE,
  normalizeCampaignSetupFromApi as normalizeCampaignSetupState,
  type AvatarState,
  type CampaignSetupState,
  type ChosenIcp,
  type LeadListSummary,
  type MessagesState,
};

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

export async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const headers = await getAuthHeaders();
  if (!headers) {
    return { ok: false, status: 401, data: null, error: "Not signed in." };
  }
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        ...headers,
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
      },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? String((body as { error?: unknown }).error ?? "")
          : "";
      return {
        ok: false,
        status: res.status,
        data: null,
        error: message || `Request failed (${res.status}).`,
      };
    }
    return { ok: true, status: res.status, data: body as T, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error." };
  }
}

export function apiGet<T>(path: string) {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Upload a file via FormData (no Content-Type header — browser sets the boundary). */
export async function apiUploadFile<T>(
  path: string,
  file: File,
  extraFields?: Record<string, string>
): Promise<ApiResult<T>> {
  const headers = await getAuthHeaders();
  if (!headers) {
    return { ok: false, status: 401, data: null, error: "Not signed in." };
  }
  const { Authorization } = headers;
  const form = new FormData();
  form.append("file", file);
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      form.append(key, value);
    }
  }
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { Authorization },
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? String((body as { error?: unknown }).error ?? "")
          : "";
      return {
        ok: false,
        status: res.status,
        data: null,
        error: message || `Upload failed (${res.status}).`,
      };
    }
    return { ok: true, status: res.status, data: body as T, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error." };
  }
}

export type { CampaignMessageDraft };
