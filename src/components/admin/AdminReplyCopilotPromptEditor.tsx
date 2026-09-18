"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  DEFAULT_ANTHROPIC_MODEL,
} from "@/lib/anthropicModel";
import { REPLY_COPILOT_DEFAULT_VOICE } from "@/lib/messaging/replyCopilot";

const MODEL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: DEFAULT_ANTHROPIC_MODEL, label: "Claude Sonnet 4.6 (recommended)" },
];

export function AdminReplyCopilotPromptEditor() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(DEFAULT_ANTHROPIC_MODEL);
  const [usingDefault, setUsingDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (cancelled || !session?.access_token) {
        setLoaded(true);
        return;
      }
      const res = await fetch("/api/admin/reply-copilot", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as {
          prompt?: string;
          model?: string;
          usingDefault?: boolean;
        };
        setPrompt(data.prompt ?? REPLY_COPILOT_DEFAULT_VOICE);
        setModel(data.model?.trim() || DEFAULT_ANTHROPIC_MODEL);
        setUsingDefault(Boolean(data.usingDefault));
      }
      setLoaded(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(payload: {
    system_prompt?: string;
    model?: string;
    reset?: boolean;
  }) {
    setSaveMessage(null);
    setSaving(true);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setSaveMessage({ type: "error", text: "Not signed in." });
      setSaving(false);
      return;
    }
    const res = await fetch("/api/admin/reply-copilot", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      usingDefault?: boolean;
      prompt?: string;
      model?: string;
    };
    setSaving(false);
    if (res.ok && data.ok) {
      setUsingDefault(Boolean(data.usingDefault));
      if (typeof data.prompt === "string") setPrompt(data.prompt);
      if (typeof data.model === "string") setModel(data.model);
      setSaveMessage({
        type: "ok",
        text: data.usingDefault ? "Back to the default voice." : "Saved.",
      });
    } else {
      setSaveMessage({ type: "error", text: data.error ?? "Failed to save." });
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor="reply-copilot-prompt"
          className="block text-sm font-medium text-slate-700"
        >
          Reply voice
        </label>
        <p className="text-xs text-slate-500">
          {usingDefault ? "Using the code default" : "Custom — overrides the default"}
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        How every coach is guided in Conversations. Channel length (short DMs vs
        email) stays locked in code. Coaches can add their own style notes in
        Settings.
      </p>
      <textarea
        id="reply-copilot-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={!loaded}
        rows={18}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
        placeholder="Loading…"
      />
      <div className="mt-4">
        <label
          htmlFor="reply-copilot-model"
          className="block text-sm font-medium text-slate-700"
        >
          Model
        </label>
        <select
          id="reply-copilot-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!loaded}
          className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save({ system_prompt: prompt, model })}
          disabled={saving || !loaded}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => void save({ reset: true, model })}
          disabled={saving || !loaded || usingDefault}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Reset to default
        </button>
        {saveMessage ? (
          <span
            className={
              saveMessage.type === "ok"
                ? "text-sm text-emerald-600"
                : "text-sm text-rose-600"
            }
          >
            {saveMessage.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
