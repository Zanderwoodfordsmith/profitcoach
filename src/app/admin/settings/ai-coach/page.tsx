"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";

export default function AdminSettingsAICoachPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        if (!cancelled) router.replace("/login");
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = (await roleRes.json().catch(() => ({}))) as { role?: string };
      if (!cancelled && body.role !== "admin") {
        setChecking(false);
        return;
      }
      setAllowed(true);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (cancelled || !session?.access_token) {
        setChecking(false);
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
      setChecking(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setSaving(false);
    if (res.ok && data.ok) {
      setSaveMessage({ type: "ok", text: "Saved." });
    } else {
      setSaveMessage({ type: "error", text: data.error ?? "Failed to save." });
    }
  }

  if (checking) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-rose-600">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Coaching AI prompt"
        description="This system prompt controls how the AI Coach behaves for all clients. The Insight AI (dashboard insights) uses a separate prompt."
        leading={
          <p className="text-sm text-slate-500">
            <Link
              href="/admin/account?tab=site"
              className="text-sky-600 hover:text-sky-700"
            >
              Site tools
            </Link>
            {" / AI Coach"}
          </p>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label htmlFor="coach-prompt" className="block text-sm font-medium text-slate-700">
          System prompt
        </label>
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
            onClick={handleSave}
            disabled={saving || !loaded}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saveMessage && (
            <span
              className={
                saveMessage.type === "ok" ? "text-sm text-emerald-600" : "text-sm text-rose-600"
              }
            >
              {saveMessage.text}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
