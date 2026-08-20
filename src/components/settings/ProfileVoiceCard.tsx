"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ProfileFieldRow,
  ProfileSectionCard,
} from "@/components/settings/ProfileFormLayout";
import { VoiceCloneMicRecorder } from "@/components/settings/VoiceCloneMicRecorder";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  VOICE_LANGUAGE_OPTIONS,
  type VoiceLanguageCode,
} from "@/lib/vocallab/cloneScript";

type CoachVoice = {
  id: string;
  status: string;
  display_name: string | null;
  language: string;
  provider_voice_id: string | null;
  sample_transcript: string | null;
  consent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type VoicePayload = {
  configured: boolean;
  coach: {
    id: string;
    full_name: string | null;
    location: string | null;
    script_ready: boolean;
  };
  script: string;
  voice: CoachVoice | null;
};

type Props = {
  impersonatingCoachId: string | null;
  /** Bump when profile name/location may have changed. */
  profileRevision?: string;
};

async function authHeaders(impersonatingCoachId: string | null) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  if (impersonatingCoachId) {
    headers["x-impersonate-coach-id"] = impersonatingCoachId;
  }
  return headers;
}

export function ProfileVoiceCard({
  impersonatingCoachId,
  profileRevision,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<VoicePayload | null>(null);
  const [language, setLanguage] = useState<VoiceLanguageCode>("en-GB");
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = await authHeaders(impersonatingCoachId);
    if (!headers) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/coach-voice", {
      headers,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as VoicePayload & {
      error?: string;
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load voice settings.");
      setLoading(false);
      return;
    }

    setPayload(body);
    if (body.voice?.language) {
      const match = VOICE_LANGUAGE_OPTIONS.find(
        (option) => option.value === body.voice?.language
      );
      if (match) setLanguage(match.value);
    }
    setLoading(false);
  }, [impersonatingCoachId]);

  useEffect(() => {
    void load();
  }, [load, profileRevision]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleClone() {
    if (!sampleFile) {
      setError("Record a sample reading the script first.");
      return;
    }
    if (!consent) {
      setError("Confirm this is the coach's own voice before cloning.");
      return;
    }

    setBusy(true);
    setError(null);
    const headers = await authHeaders(impersonatingCoachId);
    if (!headers) {
      setError("Not signed in.");
      setBusy(false);
      return;
    }

    const form = new FormData();
    form.append("file", sampleFile);
    form.append("language", language);
    form.append("consent", "true");

    const res = await fetch("/api/admin/coach-voice/clone", {
      method: "POST",
      headers,
      body: form,
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      voice?: CoachVoice;
    };
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not clone this voice.");
      void load();
      return;
    }

    setConsent(false);
    setSampleFile(null);
    void load();
  }

  async function handlePreview() {
    setPreviewBusy(true);
    setError(null);
    const headers = await authHeaders(impersonatingCoachId);
    if (!headers) {
      setError("Not signed in.");
      setPreviewBusy(false);
      return;
    }

    const res = await fetch("/api/admin/coach-voice/preview", {
      method: "POST",
      headers,
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      audio_base64?: string;
    };
    setPreviewBusy(false);

    if (!res.ok || !body.audio_base64) {
      setError(body.error ?? "Could not generate a preview.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(body.audio_base64);
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Remove this cloned voice? Anything that uses it later will stop until you clone again."
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    const headers = await authHeaders(impersonatingCoachId);
    if (!headers) {
      setError("Not signed in.");
      setBusy(false);
      return;
    }

    const res = await fetch("/api/admin/coach-voice", {
      method: "DELETE",
      headers,
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not remove this voice.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setSampleFile(null);
    setConsent(false);
    void load();
  }

  const voice = payload?.voice ?? null;
  const ready = voice?.status === "ready";
  const scriptReady = payload?.coach.script_ready ?? false;

  return (
    <ProfileSectionCard
      title="Voice"
      description="Record a short sample so AI can speak in your voice for content and coaching tools."
    >
      <p className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Admin preview — coaches cannot see or use this yet. Impersonate a coach
        (e.g. Pam) to walk through their Profile experience.
      </p>
      {loading ? (
        <p className="py-2 text-sm text-slate-600">Loading voice…</p>
      ) : (
        <div className="flex flex-col gap-1">
          {!payload?.configured ? (
            <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Add <code className="text-xs">VOCALLAB_API_KEY</code> to{" "}
              <code className="text-xs">.env.local</code> (and Vercel) to enable
              cloning.
            </p>
          ) : null}

          <ProfileFieldRow label="Accent" htmlFor="voice_language">
            <select
              id="voice_language"
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as VoiceLanguageCode)
              }
              disabled={busy}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15 disabled:bg-slate-50"
            >
              {VOICE_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </ProfileFieldRow>

          <ProfileFieldRow
            label="Script"
            htmlFor="voice_script"
            alignTop
            hint={
              scriptReady
                ? "Read this aloud when recording — numbers and variety help the clone."
                : "Save full name and location on this profile first so the script is personalised."
            }
          >
            <textarea
              id="voice_script"
              readOnly
              value={payload?.script ?? ""}
              rows={6}
              className="w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-800 outline-none"
            />
          </ProfileFieldRow>

          <ProfileFieldRow label="Sample" alignTop>
            <VoiceCloneMicRecorder
              disabled={busy || !scriptReady || !payload?.configured}
              onRecorded={(file) => {
                setSampleFile(file);
                setError(null);
              }}
              onClear={() => setSampleFile(null)}
            />
            <div className="mt-3">
              <label className="inline-flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={busy}
                  className="mt-0.5"
                />
                <span>
                  I confirm this recording is of this coach (or I have permission
                  to use their voice).
                </span>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleClone()}
                disabled={
                  busy ||
                  !sampleFile ||
                  !consent ||
                  !scriptReady ||
                  !payload?.configured
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? "Cloning…"
                  : ready
                    ? "Replace cloned voice"
                    : "Create cloned voice"}
              </button>
            </div>
          </ProfileFieldRow>

          <ProfileFieldRow label="Status" last>
            {ready ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-800">
                  Ready
                  {voice?.display_name ? (
                    <span className="text-slate-500">
                      {" "}
                      · {voice.display_name}
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePreview()}
                    disabled={previewBusy || busy || !payload?.configured}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {previewBusy ? "Generating…" : "Play AI preview"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={busy}
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Remove voice
                  </button>
                </div>
                {previewUrl ? (
                  <audio
                    className="mt-1 w-full"
                    src={previewUrl}
                    controls
                    autoPlay
                    preload="metadata"
                  />
                ) : null}
              </div>
            ) : voice?.status === "failed" ? (
              <p className="text-sm text-rose-600">
                Last clone failed
                {voice.error_message ? `: ${voice.error_message}` : "."}
              </p>
            ) : voice?.status === "pending" ? (
              <p className="text-sm text-slate-600">Clone in progress…</p>
            ) : (
              <p className="text-sm text-slate-500">No cloned voice yet.</p>
            )}
          </ProfileFieldRow>

          {error ? (
            <p className="mt-2 text-sm text-rose-600">{error}</p>
          ) : null}
        </div>
      )}
    </ProfileSectionCard>
  );
}
