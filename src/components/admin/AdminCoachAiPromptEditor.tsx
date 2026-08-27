"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export function AdminCoachAiPromptEditor() {
  const [prompt, setPrompt] = useState("");
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
      const res = await fetch("/api/admin/coach-ai-prompt", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as { prompt?: string };
        setPrompt(data.prompt ?? "");
      }
      setLoaded(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
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
    const res = await fetch("/api/admin/coach-ai-prompt", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ system_prompt: prompt }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    setSaving(false);
    if (res.ok && data.ok) {
      setSaveMessage({ type: "ok", text: "Saved." });
    } else {
      setSaveMessage({ type: "error", text: data.error ?? "Failed to save." });
    }
  }

  return (
    <div>
      <label
        htmlFor="coach-prompt"
        className="block text-sm font-medium text-slate-700"
      >
        System prompt
      </label>
      <p className="mt-1 text-xs text-slate-500">
        Controls how the AI Coach behaves for all clients. The Insight AI
        (dashboard insights) uses a separate prompt.
      </p>
      <textarea
        id="coach-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={!loaded}
        rows={14}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
        placeholder="Loading…"
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !loaded}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
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
