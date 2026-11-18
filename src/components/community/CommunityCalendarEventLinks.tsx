"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Link as LinkIcon, MessageSquare, Paperclip, X } from "lucide-react";

import {
  addCommunityCalendarEventLink,
  communityCalendarLinkOccurrenceStart,
  deleteCommunityCalendarEventLink,
  loadCommunityCalendarEventLinks,
  type CommunityCalendarEventLink,
} from "@/lib/communityCalendarData";
import type {
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";
import { communityCalendarExceptionOccurrenceStart } from "@/lib/communityCalendarTypes";
import { SUPPORT_DOCUMENT_ACCEPT, uploadSupportMediaFile } from "@/lib/communityPostMedia";
import { supabaseErrorMessage } from "@/lib/supabaseErrorMessage";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";

type Props = {
  occurrence: CommunityCalendarOccurrence;
  eventRow: CommunityCalendarEventRow | null;
  canManage: boolean;
};

function urlTitle(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "docs.google.com") {
      if (u.pathname.startsWith("/document")) return "Google Doc";
      if (u.pathname.startsWith("/spreadsheets")) return "Google Sheet";
      if (u.pathname.startsWith("/presentation")) return "Google Slides";
      if (u.pathname.startsWith("/forms")) return "Google Form";
    }
    if (host === "drive.google.com") return "Google Drive file";
    return host;
  } catch {
    return url;
  }
}

/** Zoom chat links show what they are; their label says who shared them. */
function linkTitle(link: CommunityCalendarEventLink): string {
  if (link.source !== "zoom_chat" && link.label.trim()) return link.label.trim();
  return urlTitle(link.url);
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Links and files for one calendar session. Everyone sees them; admins add and remove. */
export function CommunityCalendarEventLinks({ occurrence, eventRow, canManage }: Props) {
  const [links, setLinks] = useState<CommunityCalendarEventLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Without the event row we can't tell a series date from a one-off event.
  const occurrenceStart = eventRow
    ? communityCalendarLinkOccurrenceStart(
        eventRow,
        communityCalendarExceptionOccurrenceStart(occurrence)
      )
    : undefined;

  const reload = useCallback(async () => {
    if (occurrenceStart === undefined) return;
    try {
      setLinks(await loadCommunityCalendarEventLinks(occurrence.eventId, occurrenceStart));
    } catch (e) {
      setError(supabaseErrorMessage(e) || "Could not load links.");
    } finally {
      setLoaded(true);
    }
  }, [occurrence.eventId, occurrenceStart]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async (link: { label: string; url: string; source: "manual" | "upload" }) => {
      if (occurrenceStart === undefined) return;
      setBusy(true);
      setError(null);
      try {
        await addCommunityCalendarEventLink({
          event_id: occurrence.eventId,
          occurrence_start: occurrenceStart,
          ...link,
        });
        await reload();
        return true;
      } catch (e) {
        setError(supabaseErrorMessage(e) || "Could not add that.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [occurrence.eventId, occurrenceStart, reload]
  );

  const addLink = async () => {
    const url = normalizeUrl(urlDraft);
    if (!url) {
      setError("Paste a full link, like https://docs.google.com/…");
      return;
    }
    if (await add({ label: labelDraft.trim(), url, source: "manual" })) {
      setLabelDraft("");
      setUrlDraft("");
    }
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setError(null);
    const up = await uploadSupportMediaFile(file);
    setBusy(false);
    if ("error" in up) {
      setError(up.error);
      return;
    }
    await add({ label: up.media.name ?? file.name, url: up.media.url, source: "upload" });
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await deleteCommunityCalendarEventLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      setError(supabaseErrorMessage(e) || "Could not remove that.");
    }
  };

  if (occurrenceStart === undefined) return null;
  if (!canManage && (!loaded || links.length === 0)) return null;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Links and files
      </p>
      {links.length > 0 ? (
        <ul className="space-y-1">
          {links.map((link) => {
            const Icon =
              link.source === "upload"
                ? FileText
                : link.source === "zoom_chat"
                  ? MessageSquare
                  : LinkIcon;
            return (
              <li key={link.id} className="group flex items-start gap-2 text-sm">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span className="min-w-0 flex-1">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-words text-blue-600 hover:underline"
                  >
                    {linkTitle(link)}
                  </a>
                  {link.source === "zoom_chat" ? (
                    <span className="ml-2 text-xs text-slate-500">
                      {link.label.trim() || "From the Zoom chat"}
                    </span>
                  ) : null}
                </span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => void remove(link.id)}
                    aria-label={`Remove ${linkTitle(link)}`}
                    className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : loaded ? (
        <p className="text-sm text-slate-500">
          Nothing yet. Add a workbook, slides or the post that announced it. Links
          shared in the Zoom chat are added after the call.
        </p>
      ) : null}
      {canManage ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="Name"
              maxLength={200}
              className={fieldClass("input", "normal", "sm:w-40")}
            />
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addLink();
                }
              }}
              placeholder="https://…"
              className={fieldClass("input", "normal", "min-w-0 flex-1")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !urlDraft.trim()}
              onClick={() => void addLink()}
              className={buttonClass("second", "small")}
            >
              Add link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className={buttonClass("second", "small")}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Upload a file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={`${SUPPORT_DOCUMENT_ACCEPT},image/*`}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadFile(file);
              }}
            />
            {busy ? <span className="text-xs text-slate-500">Saving…</span> : null}
          </div>
          <p className="text-xs text-slate-500">
            {eventRow && occurrenceStart !== null
              ? "Only on this date. Other sessions in the series are unchanged."
              : "On this event."}
          </p>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
