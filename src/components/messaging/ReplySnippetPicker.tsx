"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  Search,
} from "lucide-react";
import {
  groupedReplySnippets,
  snippetBodyForChannel,
  type ReplyPlaybookSnippet,
  type ReplySnippetChannel,
  type ReplySnippetGroupId,
} from "@/lib/unipile/replySnippets";

export type SnippetFillVars = {
  firstName?: string | null;
  company?: string | null;
  theirReply?: string | null;
  coachName?: string | null;
  assessmentUrl?: string | null;
  reviewName?: string | null;
};

function fillTokens(body: string, vars: SnippetFillVars): string {
  return body
    .replace(/\{\{first_name\}\}/gi, vars.firstName?.trim() || "there")
    .replace(/\{\{company\}\}/gi, vars.company?.trim() || "business")
    .replace(
      /\{\{their_reply\}\}/gi,
      vars.theirReply?.trim() || "your note"
    )
    .replace(/\{\{coach_name\}\}/gi, vars.coachName?.trim() || "me")
    .replace(
      /\{\{assessment_url\}\}/gi,
      vars.assessmentUrl?.trim() || "[scorecard link]"
    )
    .replace(
      /\{\{review_name\}\}/gi,
      vars.reviewName?.trim() || "Business Clarity Review"
    );
}

function channelForComposer(
  replyChannel: string | null | undefined
): ReplySnippetChannel {
  if (replyChannel === "email") return "email";
  if (replyChannel === "whatsapp") return "whatsapp";
  if (replyChannel === "linkedin") return "linkedin";
  return "any";
}

function snippetMatchesChannel(
  snippet: ReplyPlaybookSnippet,
  channel: ReplySnippetChannel
): boolean {
  const sc: ReplySnippetChannel = snippet.channel;
  if (sc === "any" || channel === "any") return true;
  if (channel === "email") {
    return sc === "email" || sc === "linkedin" || Boolean(snippet.emailBody);
  }
  if (channel === "whatsapp") {
    return sc === "whatsapp" || sc === "linkedin";
  }
  return sc === "linkedin" || sc === "whatsapp";
}

type BrowseView = "folders" | ReplySnippetGroupId | "all";

/**
 * GHL-style snippets picker: folder browse → expand snippet to read full
 * message → insert into composer.
 */
export function ReplySnippetPicker({
  replyChannel,
  vars,
  onInsert,
  disabled,
}: {
  replyChannel: string;
  vars: SnippetFillVars;
  onInsert: (text: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<BrowseView>("folders");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const channel = channelForComposer(replyChannel);
  const groups = useMemo(() => groupedReplySnippets(), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setView("folders");
      setExpandedId(null);
    }
  }, [open]);

  const channelFilteredGroups = useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        snippets: g.snippets.filter((s) => snippetMatchesChannel(s, channel)),
      }))
      .filter((g) => g.snippets.length > 0);
  }, [groups, channel]);

  const totalCount = useMemo(
    () => channelFilteredGroups.reduce((n, g) => n + g.snippets.length, 0),
    [channelFilteredGroups]
  );

  const q = query.trim().toLowerCase();

  const folderRows = useMemo(() => {
    if (view !== "folders") return [];
    if (!q) {
      return channelFilteredGroups.map((g) => ({
        id: g.id as BrowseView,
        label: g.label,
        count: g.snippets.length,
      }));
    }
    return channelFilteredGroups
      .map((g) => {
        const nameHit = g.label.toLowerCase().includes(q);
        const matching = g.snippets.filter(
          (s) =>
            s.when.toLowerCase().includes(q) ||
            s.body.toLowerCase().includes(q) ||
            (s.emailBody?.toLowerCase().includes(q) ?? false)
        );
        if (!nameHit && matching.length === 0) return null;
        return {
          id: g.id as BrowseView,
          label: g.label,
          count: nameHit ? g.snippets.length : matching.length,
        };
      })
      .filter(Boolean) as Array<{
      id: BrowseView;
      label: string;
      count: number;
    }>;
  }, [view, channelFilteredGroups, q]);

  const listSnippets = useMemo(() => {
    if (view === "folders") return [] as ReplyPlaybookSnippet[];
    const pool =
      view === "all"
        ? channelFilteredGroups.flatMap((g) => g.snippets)
        : (channelFilteredGroups.find((g) => g.id === view)?.snippets ?? []);
    if (!q) return pool;
    return pool.filter(
      (s) =>
        s.when.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q) ||
        (s.emailBody?.toLowerCase().includes(q) ?? false)
    );
  }, [view, channelFilteredGroups, q]);

  const viewLabel =
    view === "all"
      ? "All Snippets"
      : (channelFilteredGroups.find((g) => g.id === view)?.label ?? "Snippets");

  function pick(snippet: ReplyPlaybookSnippet, preferEmail?: boolean) {
    const body =
      preferEmail && snippet.emailBody
        ? snippet.emailBody
        : snippetBodyForChannel(snippet, channel);
    onInsert(fillTokens(body, vars));
    setOpen(false);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        title="Snippets"
        aria-label="Snippets"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center rounded-md p-1.5 disabled:opacity-50 ${
          open
            ? "bg-sky-50 text-sky-800"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <FileText className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-2 flex w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
          <div className="shrink-0 border-b border-slate-100 px-3 py-2.5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Snippet/Folder"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {view === "folders" ? (
              <ul className="py-1">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setView("all");
                      setExpandedId(null);
                    }}
                    className="flex w-full items-baseline gap-1.5 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      All Snippets
                    </span>
                    <span className="text-slate-500">({totalCount})</span>
                  </button>
                </li>
                {folderRows.map((row) => (
                  <li key={String(row.id)}>
                    <button
                      type="button"
                      onClick={() => {
                        setView(row.id);
                        setExpandedId(null);
                        setQuery("");
                      }}
                      className="flex w-full items-baseline gap-1.5 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">
                        {row.label}
                      </span>
                      <span className="text-slate-500">({row.count})</span>
                    </button>
                  </li>
                ))}
                {folderRows.length === 0 && q ? (
                  <li className="px-4 py-8 text-center text-xs text-slate-500">
                    No folders or snippets match.
                  </li>
                ) : null}
              </ul>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-slate-100 bg-white px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setView("folders");
                      setExpandedId(null);
                      setQuery("");
                    }}
                    className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-600" />
                    {viewLabel}
                  </button>
                </div>

                {listSnippets.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-slate-500">
                    No snippets match.
                  </p>
                ) : (
                  <ul>
                    {listSnippets.map((s) => {
                      const preview = fillTokens(
                        snippetBodyForChannel(s, channel),
                        vars
                      );
                      const expanded = expandedId === s.id;
                      return (
                        <li
                          key={s.id}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpand(s.id)}
                            className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-900">
                                {s.when}
                              </span>
                              {!expanded ? (
                                <span className="mt-0.5 block truncate text-xs leading-snug text-slate-500">
                                  {preview.replace(/\s+/g, " ").trim()}
                                </span>
                              ) : null}
                            </span>
                            <ChevronDown
                              className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {expanded ? (
                            <div className="space-y-2.5 px-4 pb-3">
                              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 font-sans text-xs leading-relaxed text-slate-800">
                                {preview}
                              </pre>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => pick(s)}
                                  className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                                >
                                  Insert
                                </button>
                                {s.emailBody && channel !== "email" ? (
                                  <button
                                    type="button"
                                    onClick={() => pick(s, true)}
                                    className="text-xs font-medium text-sky-800 hover:underline"
                                  >
                                    Use longer email version
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
