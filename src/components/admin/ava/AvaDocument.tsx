"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import type { AvaCatalog, AvaFileRecord } from "@/lib/agent/avaCatalog";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return (match ? raw.slice(match[0].length) : raw).trim();
}

function stripLeadingTitle(body: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.replace(new RegExp(`^#\\s+${escaped}\\s*\\n+`, "i"), "");
}

const md: Components = {
  h1: ({ children }) => (
    <h2 className="mt-10 mb-3 text-[1.375rem] font-semibold tracking-[-0.02em] text-[#0f172a] first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 text-[1.375rem] font-semibold tracking-[-0.02em] text-[#0f172a] first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-2 text-[1.0625rem] font-semibold text-[#0f172a] first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-4 text-[1.0625rem] leading-[1.65] text-[#334155] last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-5 text-[1.0625rem] leading-[1.65] text-[#334155] last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-2 pl-5 text-[1.0625rem] leading-[1.65] text-[#334155] last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[#0f172a]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 text-[1.0625rem] leading-[1.65] text-[#475569] last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    if (className?.includes("language-")) {
      return (
        <code className="block overflow-x-auto rounded-lg bg-[#f1f5f9] px-3 py-2 font-mono text-[13px] text-[#0f172a]">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-[#f1f5f9] px-1 py-0.5 font-mono text-[0.9em] text-[#0f172a]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="mb-4 overflow-x-auto last:mb-0">{children}</pre>,
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-[#0c5290] underline decoration-[#7dd3fc] underline-offset-2 hover:text-[#0a4478]">
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-[#e2e8f0]" />,
};

async function authHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}

export function AvaDocument({
  file,
  title,
  summary,
  meta,
  onCatalog,
}: {
  file: AvaFileRecord;
  title: string;
  summary?: string;
  meta?: string;
  onCatalog: (catalog: AvaCatalog) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.content);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDraft(file.content);
    setStatus(null);
    setEditing(false);
  }, [file.id, file.content]);

  const dirty = draft !== file.content;
  const body = stripLeadingTitle(stripFrontmatter(editing ? draft : file.content), title);

  async function save() {
    if (saving || !dirty || !draft.trim() || !file.editable) return;
    setSaving(true);
    setStatus(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/ava/context", {
        method: "PUT",
        headers,
        body: JSON.stringify({ file: file.id, content: draft }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; catalog?: AvaCatalog } | null;
      if (!res.ok || !data?.catalog) {
        setStatus(data?.error || "Save failed.");
        return;
      }
      onCatalog(data.catalog);
      setEditing(false);
      setStatus("Saved. Live on Ava's next turn.");
    } finally {
      setSaving(false);
    }
  }

  async function resetToRepo() {
    if (saving || !file.overridden) return;
    if (!window.confirm("Remove the edited version and fall back to the repo file?")) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(`/api/admin/ava/context?file=${encodeURIComponent(file.id)}`, {
        method: "DELETE",
        headers,
      });
      const data = (await res.json().catch(() => null)) as { catalog?: AvaCatalog; error?: string } | null;
      if (!res.ok || !data?.catalog) {
        setStatus(data?.error || "Reset failed.");
        return;
      }
      onCatalog(data.catalog);
      setEditing(false);
      setStatus("Reset to the repo version.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="mx-auto w-full max-w-[54rem] px-5 py-8 md:px-10 md:py-10">
      <header className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="min-w-0 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">
            {title}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {file.editable ? (
              <button
                type="button"
                onClick={() => {
                  if (editing && dirty) setDraft(file.content);
                  setEditing((v) => !v);
                  setStatus(null);
                }}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#0c5290] hover:bg-[#e0f2fe]"
              >
                {editing ? "Done" : "Edit"}
              </button>
            ) : null}
          </div>
        </div>
        {summary ? (
          <p className="mt-2.5 text-lg leading-[1.55] text-[#475569]">{summary}</p>
        ) : null}
        <p className="mt-3 text-xs text-[#64748b]">
          <span className="font-mono">{file.id}</span>
          {meta ? ` · ${meta}` : ""}
          {file.overridden ? " · edited, live" : file.editable ? "" : " · read-only"}
          {file.sharedWithBrand ? " · also in Brand" : ""}
        </p>
      </header>
      <hr className="mt-6 border-[#e2e8f0]" />

      {editing ? (
        <div className="mt-8">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={22}
            spellCheck={false}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-800 focus:border-sky-400 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !dirty || !draft.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0c5290] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0a4478] disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save changes
            </button>
            {file.overridden ? (
              <button
                type="button"
                onClick={() => void resetToRepo()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Reset to repo
              </button>
            ) : null}
            <span className="ml-auto text-xs text-slate-500">{wordCount(draft).toLocaleString()} words</span>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
            {body}
          </ReactMarkdown>
        </div>
      )}

      {status ? <p className="mt-6 text-sm font-medium text-slate-700">{status}</p> : null}
    </article>
  );
}
