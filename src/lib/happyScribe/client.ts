import "server-only";

import { HappyScribeError } from "./error";
import {
  happyScribeJsonExportPayload,
  happyScribeTranscriptionPayload,
  isValidHttpsMediaUrl,
} from "./payload";

const HAPPY_SCRIBE_API_URL = "https://www.happyscribe.com/api/v1";
const MAX_JSON_BYTES = 2_000_000;
const MAX_EXPORT_BYTES = 10_000_000;
const REQUEST_TIMEOUT_MS = 20_000;

export type HappyScribeTranscriptionState =
  | "initial"
  | "ingesting"
  | "automatic_transcribing"
  | "automatic_done"
  | "aligning"
  | "locked"
  | "failed"
  | "demo"
  | string;

export type HappyScribeTranscription = {
  id: string;
  name: string;
  state: HappyScribeTranscriptionState;
  language: string | null;
  audioLengthInSeconds: number | null;
  failureReason: string | null;
  failureMessage: string | null;
  downloadUrl: string | null;
};

export type HappyScribeExport = {
  id: string;
  state: "pending" | "processing" | "ready" | "expired" | "failed" | string;
  format: string;
  transcriptionIds: string[];
  downloadLink: string | null;
};

export type HappyScribeOrganization = {
  id: number;
  name: string;
  role: string;
};

function apiKey(): string {
  const value = process.env.HAPPYSCRIBE_API_KEY?.trim();
  if (!value) {
    throw new HappyScribeError("Happy Scribe is not configured.", 503);
  }
  return value;
}

function providerId(value: string, label: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(trimmed)) {
    throw new HappyScribeError(`Invalid Happy Scribe ${label}.`, 400);
  }
  return trimmed;
}

function parseJson(text: string): unknown {
  if (text.length > MAX_JSON_BYTES) {
    throw new HappyScribeError("Happy Scribe response was too large.", 502);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HappyScribeError("Happy Scribe returned invalid JSON.", 502);
  }
}

async function requestJson(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${HAPPY_SCRIBE_API_URL}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey()}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = `Happy Scribe request failed (${response.status}).`;
      if (text.length <= MAX_JSON_BYTES) {
        try {
          const body = JSON.parse(text) as Record<string, unknown>;
          const errors = Array.isArray(body.errors)
            ? body.errors.filter((value): value is string => typeof value === "string")
            : [];
          if (errors.length > 0) detail = errors.slice(0, 3).join("; ");
        } catch {
          // Keep the normalized status message; provider bodies are untrusted.
        }
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new HappyScribeError(
        detail.slice(0, 500),
        response.status,
        Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : null,
      );
    }
    return parseJson(text);
  } catch (error) {
    if (error instanceof HappyScribeError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HappyScribeError("Happy Scribe request timed out.", 504);
    }
    throw new HappyScribeError("Could not reach Happy Scribe.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HappyScribeError("Happy Scribe returned an unexpected response.", 502);
  }
  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function transcriptionFromResponse(value: unknown): HappyScribeTranscription {
  const row = record(value);
  const id = stringOrNull(row.id);
  const name = stringOrNull(row.name);
  const state = stringOrNull(row.state);
  if (!id || !name || !state) {
    throw new HappyScribeError("Happy Scribe returned an invalid transcription.", 502);
  }
  const links = row._links && typeof row._links === "object"
    ? (row._links as Record<string, unknown>)
    : null;
  const self = links?.self && typeof links.self === "object"
    ? (links.self as Record<string, unknown>)
    : null;
  return {
    id: providerId(id, "transcription id"),
    name,
    state,
    language: stringOrNull(row.language),
    audioLengthInSeconds: numberOrNull(row.audioLengthInSeconds),
    failureReason: stringOrNull(row.failureReason),
    failureMessage: stringOrNull(row.failureMessage),
    downloadUrl: stringOrNull(self?.downloadUrl),
  };
}

function exportFromResponse(value: unknown): HappyScribeExport {
  const row = record(value);
  const id = stringOrNull(row.id);
  const state = stringOrNull(row.state);
  const format = stringOrNull(row.format);
  const transcriptionIds = Array.isArray(row.transcription_ids)
    ? row.transcription_ids.filter((item): item is string => typeof item === "string")
    : [];
  if (!id || !state || !format || transcriptionIds.length === 0) {
    throw new HappyScribeError("Happy Scribe returned an invalid export.", 502);
  }
  return {
    id: providerId(id, "export id"),
    state,
    format,
    transcriptionIds: transcriptionIds.map((item) => providerId(item, "transcription id")),
    downloadLink: stringOrNull(row.download_link),
  };
}

export async function listHappyScribeOrganizations(): Promise<HappyScribeOrganization[]> {
  const body = record(await requestJson("/organizations"));
  if (!Array.isArray(body.organizations)) {
    throw new HappyScribeError("Happy Scribe returned no organizations.", 502);
  }
  return body.organizations.flatMap((value) => {
    const row = record(value);
    const id = numberOrNull(row.id);
    const name = stringOrNull(row.name);
    const role = stringOrNull(row.role);
    return id != null && name && role ? [{ id, name, role }] : [];
  });
}

export function configuredHappyScribeOrganizationId(): number | null {
  const raw = process.env.HAPPYSCRIBE_ORGANIZATION_ID?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function createHappyScribeTranscription(input: {
  organizationId: number;
  name: string;
  language?: string;
  sourceUrl: string;
  service?: "auto" | "pro";
  tag?: string;
}): Promise<HappyScribeTranscription> {
  if (!Number.isSafeInteger(input.organizationId) || input.organizationId <= 0) {
    throw new HappyScribeError("Invalid Happy Scribe organization id.", 400);
  }
  const name = input.name.trim().slice(0, 500);
  const sourceUrl = input.sourceUrl.trim();
  if (!name || !isValidHttpsMediaUrl(sourceUrl)) {
    throw new HappyScribeError("Happy Scribe transcription input is invalid.", 400);
  }
  const response = await requestJson("/transcriptions", {
    method: "POST",
    body: JSON.stringify(
      happyScribeTranscriptionPayload({
        organizationId: input.organizationId,
        name,
        language: input.language ?? "en",
        sourceUrl,
        service: input.service ?? "auto",
        tag: input.tag,
      }),
    ),
  });
  return transcriptionFromResponse(response);
}

export async function getHappyScribeTranscription(
  transcriptionId: string,
): Promise<HappyScribeTranscription> {
  return transcriptionFromResponse(
    await requestJson(`/transcriptions/${providerId(transcriptionId, "transcription id")}`),
  );
}

export async function createHappyScribeJsonExport(
  transcriptionId: string,
): Promise<HappyScribeExport> {
  const id = providerId(transcriptionId, "transcription id");
  return exportFromResponse(
    await requestJson("/exports", {
      method: "POST",
      body: JSON.stringify(happyScribeJsonExportPayload(id)),
    }),
  );
}

export async function getHappyScribeExport(exportId: string): Promise<HappyScribeExport> {
  return exportFromResponse(
    await requestJson(`/exports/${providerId(exportId, "export id")}`),
  );
}

function isAllowedProviderDownloadUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "happyscribe.com" ||
    hostname.endsWith(".happyscribe.com") ||
    hostname.endsWith(".amazonaws.com")
  );
}

export async function downloadHappyScribeExport(downloadLink: string): Promise<unknown> {
  if (!isAllowedProviderDownloadUrl(downloadLink)) {
    throw new HappyScribeError("Happy Scribe returned an invalid download URL.", 502);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(downloadLink, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_EXPORT_BYTES) {
      throw new HappyScribeError("Happy Scribe export was too large.", 502);
    }
    const text = await response.text();
    if (!response.ok) {
      throw new HappyScribeError("Could not download Happy Scribe export.", 502);
    }
    if (text.length > MAX_EXPORT_BYTES) {
      throw new HappyScribeError("Happy Scribe export was too large.", 502);
    }
    return parseJson(text);
  } catch (error) {
    if (error instanceof HappyScribeError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HappyScribeError("Happy Scribe export download timed out.", 504);
    }
    throw new HappyScribeError("Could not download Happy Scribe export.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
