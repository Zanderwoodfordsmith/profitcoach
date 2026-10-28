"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { supabaseClient } from "@/lib/supabaseClient";
import { PROFILE_REWRITE_DEFAULT_VOICE } from "@/lib/linkedinProfileOptimizer/prompts";

export function AdminLinkedInOptimizerPromptEditor() {
  const [prompt, setPrompt] = useState("");
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
      const res = await fetch("/api/admin/linkedin-optimizer-prompt", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as {
          prompt?: string;
          usingDefault?: boolean;
        };
        setPrompt(data.prompt ?? PROFILE_REWRITE_DEFAULT_VOICE);
        setUsingDefault(Boolean(data.usingDefault));
      }
      setLoaded(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(payload: { system_prompt?: string; reset?: boolean }) {
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
    const res = await fetch("/api/admin/linkedin-optimizer-prompt", {
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
    };
    setSaving(false);
    if (res.ok && data.ok) {
      setUsingDefault(Boolean(data.usingDefault));
      if (typeof data.prompt === "string") setPrompt(data.prompt);
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
          htmlFor="linkedin-optimizer-prompt"
          className="block text-sm font-medium text-slate-700"
        >
          Rewrite voice
        </label>
        <p className="text-xs text-slate-500">
          {usingDefault ? "Using the code default" : "Custom — overrides the default"}
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        The rewrite voice for every coach. The JSON response shape stays locked
        in code so a bad edit cannot break Apply.
      </p>
      <textarea
        id="linkedin-optimizer-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={!loaded}
        rows={18}
        className={fieldClass("textarea", "normal", "mt-2 font-mono")}
        placeholder="Loading…"
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save({ system_prompt: prompt })}
          disabled={saving || !loaded}
          className={buttonClass("main")}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => void save({ reset: true })}
          disabled={saving || !loaded || usingDefault}
          className={buttonClass("second")}
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
