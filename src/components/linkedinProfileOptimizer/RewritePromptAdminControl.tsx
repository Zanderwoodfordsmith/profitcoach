"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Shield, X } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { PROFILE_REWRITE_DEFAULT_VOICE } from "@/lib/linkedinProfileOptimizer/prompts";

async function authHeaders(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return { Authorization: `Bearer ${session.access_token}` };
}

export function RewritePromptAdminControl() {
  const pathname = usePathname();
  const onAdminPath = pathname.startsWith("/admin");
  const [isAdmin, setIsAdmin] = useState(onAdminPath);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [usingDefault, setUsingDefault] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (onAdminPath) {
      setIsAdmin(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = (await roleRes.json().catch(() => ({}))) as { role?: string };
      if (!cancelled) setIsAdmin(body.role === "admin");
    })();
    return () => {
      cancelled = true;
    };
  }, [onAdminPath]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers || cancelled) return;
      const res = await fetch("/api/admin/linkedin-optimizer-prompt", {
        headers,
      });
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as {
          prompt?: string;
          usingDefault?: boolean;
        };
        setPrompt(data.prompt ?? PROFILE_REWRITE_DEFAULT_VOICE);
        setUsingDefault(Boolean(data.usingDefault));
      } else {
        setPrompt(PROFILE_REWRITE_DEFAULT_VOICE);
        setMessage({ type: "error", text: "Could not load the prompt." });
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  async function save(payload: { system_prompt?: string; reset?: boolean }) {
    setMessage(null);
    setSaving(true);
    const headers = await authHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Not signed in." });
      setSaving(false);
      return;
    }
    const res = await fetch("/api/admin/linkedin-optimizer-prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
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
      setMessage({
        type: "ok",
        text: data.usingDefault ? "Back to the default voice." : "Saved.",
      });
    } else {
      setMessage({ type: "error", text: data.error ?? "Failed to save." });
    }
  }

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Edit rewrite prompt"
        aria-label="Edit rewrite prompt"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
      >
        <Shield className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close prompt editor"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-labelledby="rewrite-prompt-title"
            className="relative z-[81] flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p
                  id="rewrite-prompt-title"
                  className="text-sm font-semibold text-slate-900"
                >
                  Rewrite prompt
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {usingDefault
                    ? "Using the code default — save to override for every coach."
                    : "Custom voice — applies to every coach rewrite."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={!loaded}
                rows={16}
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void save({ system_prompt: prompt })}
                  disabled={saving || !loaded}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    "Save"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void save({ reset: true })}
                  disabled={saving || !loaded || usingDefault}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Reset to default
                </button>
                <Link
                  href="/admin/brand?tab=brain&brainTab=skills&open=linkedin_profile"
                  className="text-sm font-medium text-sky-800 hover:text-sky-950"
                >
                  Open full editor →
                </Link>
                {message ? (
                  <span
                    className={
                      message.type === "ok"
                        ? "text-sm text-emerald-600"
                        : "text-sm text-rose-600"
                    }
                  >
                    {message.text}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
