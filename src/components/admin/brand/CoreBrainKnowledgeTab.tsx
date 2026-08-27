"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { BrainExpandableItem } from "@/components/admin/brand/BrainExpandableItem";
import { supabaseClient } from "@/lib/supabaseClient";

export type CanonFile = {
  file: string;
  label: string;
  description: string;
  group: "core" | "skill";
  content: string;
  overridden: boolean;
  updated_at: string | null;
  missing: boolean;
};

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function KnowledgeFileEditor({
  file,
  authHeaders,
  onSaved,
}: {
  file: CanonFile;
  authHeaders: () => Promise<Record<string, string> | null>;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(file.content);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDraft(file.content);
    setStatus(null);
  }, [file.file, file.content]);

  const dirty = draft !== file.content;

  async function save() {
    if (saving || !dirty || !draft.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/brand-knowledge", {
        method: "PUT",
        headers,
        body: JSON.stringify({ file: file.file, content: draft }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus(body.error || "Save failed.");
        return;
      }
      setStatus("Saved — live in the next AI message.");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function resetToRepo() {
    if (
      saving ||
      !window.confirm("Remove the edited version and fall back to the repo file?")
    ) {
      return;
    }
    setSaving(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch(
        `/api/admin/brand-knowledge?file=${encodeURIComponent(file.file)}`,
        { method: "DELETE", headers }
      );
      setStatus("Reset to the repo version.");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-slate-500">{file.description}</p>
      <p className="mt-1 text-xs text-slate-400">
        {file.overridden
          ? `Edited version live${file.updated_at ? ` · ${new Date(file.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`
          : "Repo version (no edits)"}
        {" · "}
        <span className="font-mono">{file.file}</span>
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={18}
        spellCheck={false}
        className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-800 focus:border-sky-400 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </button>
        {file.overridden ? (
          <button
            type="button"
            onClick={() => void resetToRepo()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to repo
          </button>
        ) : null}
        <span className="ml-auto text-xs text-slate-400">
          {wordCount(draft).toLocaleString()} words
        </span>
      </div>
      {status ? (
        <p className="mt-2 text-sm font-medium text-slate-600">{status}</p>
      ) : null}
    </div>
  );
}

function KnowledgeGroup({
  title,
  hint,
  files,
  openId,
  setOpenId,
  authHeaders,
  onSaved,
}: {
  title: string;
  hint?: string;
  files: CanonFile[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  authHeaders: () => Promise<Record<string, string> | null>;
  onSaved: () => Promise<void>;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {title}
        </p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {files.map((f) => {
        const open = openId === f.file;
        return (
          <BrainExpandableItem
            key={f.file}
            id={f.file}
            open={open}
            onToggle={() => setOpenId(open ? null : f.file)}
            title={f.label}
            subtitle={f.description}
            badges={
              <>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                  {wordCount(f.content).toLocaleString()}w
                </span>
                {f.overridden ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                    Edited
                  </span>
                ) : null}
                {f.missing ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Missing in repo
                  </span>
                ) : null}
              </>
            }
          >
            <KnowledgeFileEditor
              file={f}
              authHeaders={authHeaders}
              onSaved={onSaved}
            />
          </BrainExpandableItem>
        );
      })}
    </div>
  );
}

export function CoreBrainKnowledgeTab({
  initialOpenFile,
}: {
  initialOpenFile?: string | null;
}) {
  const [files, setFiles] = useState<CanonFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(initialOpenFile ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }, []);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/admin/brand-knowledge", { headers });
    if (!res.ok) {
      setLoadError("Could not load knowledge files.");
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { files?: CanonFile[] };
    setFiles(body.files ?? []);
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialOpenFile) setOpenId(initialOpenFile);
  }, [initialOpenFile]);

  if (loading) {
    return <p className="py-10 text-sm text-slate-500">Loading knowledge…</p>;
  }

  if (loadError) {
    return <p className="py-10 text-sm text-rose-600">{loadError}</p>;
  }

  const core = files.filter((f) => f.group === "core");
  const skill = files.filter((f) => f.group === "skill");

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-slate-500">
        Brand canon loaded into AI prompts. Open a file to read or edit — changes
        go live on the next message. Playbooks and each coach&apos;s personal
        brain are separate.
      </p>
      <KnowledgeGroup
        title="Always loaded — core"
        hint="Every AI prompt gets these before the coach's personal brain."
        files={core}
        openId={openId}
        setOpenId={setOpenId}
        authHeaders={authHeaders}
        onSaved={load}
      />
      <KnowledgeGroup
        title="Loaded per skill"
        hint="Pulled in when a skill needs them (outreach, avatar, copy, etc.)."
        files={skill}
        openId={openId}
        setOpenId={setOpenId}
        authHeaders={authHeaders}
        onSaved={load}
      />
    </div>
  );
}
