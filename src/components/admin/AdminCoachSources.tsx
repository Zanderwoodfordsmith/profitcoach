"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";

import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
import { formatDateDisplay } from "@/lib/formatDateDisplay";
import { supabaseClient } from "@/lib/supabaseClient";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type Source = {
  id: string;
  source: string;
  label: string;
  title: string;
  called_at: string | null;
  ingested_at: string;
  body: string;
  file_url: string | null;
  added_by_name: string | null;
};

type Mode = "text" | "file";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** What Ava reads when she drafts this coach's Blueprint, and a way to add more. Admin only. */
export function AdminCoachSources({ coachSlug }: { coachSlug: string }) {
  const api = `/api/admin/coaches/${encodeURIComponent(coachSlug)}/sources`;
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<Mode>("file");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const call = useCallback(
    async (init?: RequestInit, query = ""): Promise<Record<string, unknown>> => {
      const token = await getValidSupabaseAccessToken();
      if (!token) throw new Error("Please sign in again.");
      const res = await fetch(`${api}${query}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Something went wrong.");
      return json;
    },
    [api]
  );

  useEffect(() => {
    call()
      .then((json) => setSources(json.sources as Source[]))
      .catch((err: Error) => setError(err.message));
  }, [call]);

  function resetForm() {
    setAdding(false);
    setTitle("");
    setDate(today());
    setText("");
    setFile(null);
  }

  async function save() {
    setError(null);
    try {
      let filePath = "";
      if (mode === "file") {
        if (!file) throw new Error("Choose a file.");
        setBusy("Uploading…");
        const slot = await call({ method: "POST", body: JSON.stringify({ action: "upload", fileName: file.name }) });
        const { error: uploadError } = await supabaseClient.storage
          .from("coach-sources")
          .uploadToSignedUrl(slot.path as string, slot.token as string, file, { contentType: file.type || undefined });
        if (uploadError) throw new Error(uploadError.message);
        filePath = slot.path as string;
        setBusy("Transcribing. A 10-minute recording takes about a minute…");
      } else {
        setBusy("Saving…");
      }
      const json = await call({
        method: "POST",
        body: JSON.stringify({ title, date, text: mode === "text" ? text : "", filePath }),
      });
      setSources(json.sources as Source[]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save it.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setError(null);
    setBusy("Removing…");
    try {
      const json = await call({ method: "DELETE" }, `?id=${encodeURIComponent(id)}`);
      setSources(json.sources as Source[]);
      setConfirmRemove(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove it.");
    } finally {
      setBusy(null);
    }
  }

  const toggle = (id: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
        mode === id ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className={cardClass("plain", "space-y-5 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sources</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            What Ava reads when she drafts this coach&apos;s Blueprint. Pam&apos;s notes come first and win where they differ.
          </p>
        </div>
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className={buttonClass("second", "small")}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add a source
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {toggle("file", "Upload audio or video")}
            {toggle("text", "Paste text")}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Voice note: how he picks which shops to sell to"
                className={fieldClass("input", "normal", "mt-1 w-full")}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass("input", "normal", "mt-1 w-full")}
              />
            </label>
          </div>
          {mode === "file" ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">File</span>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, ""));
                }}
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700 file:ring-1 file:ring-slate-200"
              />
              <span className="mt-1 block text-xs text-slate-500">Up to 500 MB. We keep the file and type up what&apos;s said.</span>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Text</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Paste an email, notes from a call, anything the coach told us."
                className={fieldClass("textarea", "normal", "mt-1 w-full")}
              />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void save()} disabled={!!busy} className={buttonClass("main", "small")}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Save
            </button>
            <button type="button" onClick={resetForm} disabled={!!busy} className={buttonClass("quiet", "small")}>
              Cancel
            </button>
            {busy ? <span className="text-sm text-slate-500">{busy}</span> : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {sources === null && !error ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : null}
      {sources?.length === 0 ? <p className="text-sm text-slate-500">Nothing yet.</p> : null}

      {sources?.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {sources.map((s) => {
            const open = openId === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : s.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  aria-expanded={open}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{s.title || s.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {s.label}
                      {s.called_at ? ` · ${formatDateDisplay(new Date(s.called_at))}` : ""}
                      {` · ${wordCount(s.body).toLocaleString()} words`}
                      {s.added_by_name ? ` · added by ${s.added_by_name}` : ""}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {open ? (
                  <div className="space-y-3 px-4 pb-4">
                    {s.file_url ? (
                      <audio controls preload="none" src={s.file_url} className="w-full" />
                    ) : null}
                    <div className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                      {s.body}
                    </div>
                    {confirmRemove === s.id ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-slate-700">Ava stops reading this. Remove it?</span>
                        <button type="button" onClick={() => void remove(s.id)} disabled={!!busy} className={buttonClass("delete", "small")}>
                          Yes, remove
                        </button>
                        <button type="button" onClick={() => setConfirmRemove(null)} className={buttonClass("quiet", "small")}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmRemove(s.id)} className={buttonClass("quiet", "small")}>
                        Remove
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
