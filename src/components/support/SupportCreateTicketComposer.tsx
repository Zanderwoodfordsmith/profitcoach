"use client";

import { ChevronDown, ImagePlus, Video, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SupportVoiceRecorder,
  pendingSupportVoiceToFile,
  revokePendingSupportVoice,
  type PendingSupportVoice,
} from "@/components/support/SupportVoiceRecorder";
import {
  COMMUNITY_POST_MEDIA_MAX,
  inferCommunityPostMediaKindFromUrl,
  uploadSupportMediaFile,
  validateSupportMediaFile,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";
import { notifySupportCountsChanged } from "@/components/layout/useNewFeedbackCount";
import {
  DEFAULT_SUPPORT_ASSIGNEE_ID,
  assigneeDisplayName,
  type SupportAssignee,
} from "@/lib/support/assignees";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  SUPPORT_AUTHOR_SELECT,
  authorDisplayName,
  mapSupportTicketRow,
  supportTypeOptionLabel,
  type SupportTicket,
  type SupportTicketType,
} from "@/lib/support/tickets";

type PendingMedia = { key: string; file: File; previewUrl: string };

const TYPE_OPTIONS: SupportTicketType[] = [
  "bug",
  "idea",
  "question",
  "billing",
  "other",
];

export type SupportCreateTicketCoachOption = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

export function CoachSearchCombobox({
  coaches,
  value,
  onChange,
  placeholder = "Select coach…",
  allowClear = false,
}: {
  coaches: SupportCreateTicketCoachOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = coaches.find((c) => c.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((c) =>
      authorDisplayName(c).toLowerCase().includes(q)
    );
  }, [coaches, query]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setQuery("");
        }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[15px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          className={`min-w-0 truncate ${
            selected ? "text-slate-900" : "text-slate-400"
          }`}
        >
          {selected ? authorDisplayName(selected) : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-[130] mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5"
          role="listbox"
          aria-label="Coaches"
        >
          <div className="border-b border-slate-100 px-2 py-2">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search coaches…"
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
              aria-label="Filter coaches"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {allowClear && value ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelect("")}
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Unlink coach
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No matches.</li>
            ) : (
              filtered.map((c) => {
                const active = c.id === value;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => handleSelect(c.id)}
                      className={`flex w-full px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-sky-50 font-medium text-sky-900"
                          : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      {authorDisplayName(c)}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  /** Effective author (impersonated coach when demo-toggling). Ignored when coachOptions is set. */
  authorId?: string | null;
  /** When set, show coach picker and create the ticket on that coach's behalf. */
  coachOptions?: SupportCreateTicketCoachOption[];
  /** Admin assignees for the create form (admin create only). Defaults to Zander. */
  assigneeOptions?: SupportAssignee[];
  /** Admin profile id for `created_by_admin` when creating on behalf of a coach. */
  createdByAdminId?: string | null;
  onClose: () => void;
  onCreated: (ticket: SupportTicket) => void;
};

export function SupportCreateTicketComposer({
  authorId,
  coachOptions,
  assigneeOptions,
  createdByAdminId,
  onClose,
  onCreated,
}: Props) {
  const isAdminCreate = Boolean(coachOptions && coachOptions.length > 0);
  const [coachId, setCoachId] = useState("");
  const [assignedTo, setAssignedTo] = useState(DEFAULT_SUPPORT_ASSIGNEE_ID);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [type, setType] = useState<SupportTicketType>("bug");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [pendingVoice, setPendingVoice] = useState<PendingSupportVoice | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminCreate) return;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setAccountEmail(user?.email?.trim() || null);
    })();
  }, [isAdminCreate]);

  useEffect(() => {
    return () => {
      for (const p of pendingMedia) URL.revokeObjectURL(p.previewUrl);
      revokePendingSupportVoice(pendingVoice);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit =
    title.trim().length > 0 &&
    (details.trim().length > 0 ||
      pendingMedia.length > 0 ||
      Boolean(pendingVoice)) &&
    (!isAdminCreate || Boolean(coachId)) &&
    !saving;

  const pendingPreviews = useMemo(
    () =>
      pendingMedia.map((p) => ({
        key: p.key,
        previewUrl: p.previewUrl,
        kind:
          p.file.type.startsWith("video/") ||
          inferCommunityPostMediaKindFromUrl(p.file.name) === "video"
            ? ("video" as const)
            : p.file.type.startsWith("audio/") ||
                inferCommunityPostMediaKindFromUrl(p.file.name) === "audio"
              ? ("audio" as const)
              : ("image" as const),
        name: p.file.name,
      })),
    [pendingMedia]
  );

  function addPendingFiles(files: File[], { allowAudio = false } = {}) {
    const room = COMMUNITY_POST_MEDIA_MAX - pendingMedia.length;
    if (room <= 0) return;
    const next = [...pendingMedia];
    for (const file of files.slice(0, room)) {
      const validated = validateSupportMediaFile(file);
      if ("error" in validated) {
        setError(validated.error);
        continue;
      }
      if (validated.kind === "audio" && !allowAudio) {
        setError("Use the toolbar mic to attach audio.");
        continue;
      }
      next.push({
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPendingMedia(next);
  }

  function removePending(key: string) {
    const removed = pendingMedia.find((p) => p.key === key);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    setPendingMedia(pendingMedia.filter((p) => p.key !== key));
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user?.id) throw new Error("Could not determine your account.");

      const createdBy = isAdminCreate
        ? coachId
        : authorId?.trim() || user.id;
      if (!createdBy) throw new Error("Select a coach for this ticket.");

      const media: CommunityPostMediaItem[] = [];
      for (const item of pendingMedia) {
        const up = await uploadSupportMediaFile(item.file);
        if ("error" in up) throw new Error(up.error);
        media.push(up.media);
      }
      if (pendingVoice) {
        const up = await uploadSupportMediaFile(
          pendingSupportVoiceToFile(pendingVoice)
        );
        if ("error" in up) throw new Error(up.error);
        media.push(up.media);
      }

      const detailsText =
        details.trim() ||
        (pendingVoice ? "See voice note attached." : "(See attachments.)");

      const insertPayload = isAdminCreate
        ? {
            created_by: createdBy,
            created_by_admin: createdByAdminId ?? user.id,
            type,
            title: title.trim(),
            details: detailsText,
            media: media.length > 0 ? media : null,
            member_notify_email: notifyEmail,
            source: "admin_created" as const,
            assigned_to: assignedTo || DEFAULT_SUPPORT_ASSIGNEE_ID,
            status: "open" as const,
            page_path:
              typeof window !== "undefined"
                ? window.location.pathname + window.location.search
                : null,
            user_agent:
              typeof navigator !== "undefined" ? navigator.userAgent : null,
          }
        : {
            created_by: createdBy,
            type,
            title: title.trim(),
            details: detailsText,
            media: media.length > 0 ? media : null,
            member_notify_email: notifyEmail,
            page_path:
              typeof window !== "undefined"
                ? window.location.pathname + window.location.search
                : null,
            user_agent:
              typeof navigator !== "undefined" ? navigator.userAgent : null,
          };

      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_reports")
        .insert(insertPayload)
        .select(
          isAdminCreate
            ? `
          id, created_at, created_by, ticket_number, type, title, details, page_path, status,
          source, assigned_to, community_post_id, created_by_admin, contact_email, submitter_name,
          importance, ease, media, member_notify_email,
          author:profiles!created_by ( ${SUPPORT_AUTHOR_SELECT} ),
          assignee:profiles!assigned_to ( ${SUPPORT_AUTHOR_SELECT} )
        `
            : `
          id, created_at, created_by, ticket_number, type, title, details, page_path, status,
          media, member_notify_email,
          author:profiles!created_by ( ${SUPPORT_AUTHOR_SELECT} )
        `
        )
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("Ticket was not created.");

      const created = mapSupportTicketRow(
        data as unknown as Parameters<typeof mapSupportTicketRow>[0]
      );
      for (const p of pendingMedia) URL.revokeObjectURL(p.previewUrl);
      revokePendingSupportVoice(pendingVoice);
      notifySupportCountsChanged();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send ticket.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          {isAdminCreate ? "Create ticket for coach" : "New ticket"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {isAdminCreate ? (
          <div>
            <span className="text-sm font-medium text-slate-700">Coach</span>
            <CoachSearchCombobox
              coaches={coachOptions ?? []}
              value={coachId}
              onChange={setCoachId}
            />
          </div>
        ) : null}

        {isAdminCreate && (assigneeOptions?.length ?? 0) > 0 ? (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Assignee</span>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              {assigneeOptions!.map((a) => (
                <option key={a.id} value={a.id}>
                  {assigneeDisplayName(a)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Subject</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A short summary of what's going on…"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </label>

        <div>
          <span className="text-sm font-medium text-slate-700">Type</span>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Ticket type"
          >
            {TYPE_OPTIONS.map((option) => {
              const selected = type === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  aria-pressed={selected}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                    selected
                      ? "bg-sky-700 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {supportTypeOptionLabel(option)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700">Description</span>
          <SupportVoiceRecorder
            pending={pendingVoice}
            onChange={(note) => {
              setPendingVoice((prev) => {
                if (prev?.url && prev.url !== note?.url) {
                  URL.revokeObjectURL(prev.url);
                }
                return note;
              });
            }}
            onTranscribed={(spoken) => {
              setDetails((prev) => {
                const base = prev.trim();
                return base ? `${base}\n\n${spoken}` : spoken;
              });
              setError(null);
            }}
            directRecord
            disabled={saving}
            onError={setError}
            layout={({ micButton, chrome }) => (
              <div className="mt-1.5 space-y-2">
                <div className="relative">
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="What happened? Type here, or tap the mic to speak — we’ll fill the text and keep the recording so support can hear your tone."
                    rows={4}
                    className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 pr-11 pb-10 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <div className="absolute bottom-2 right-2">{micButton}</div>
                </div>
                {chrome}
              </div>
            )}
          />
        </div>

        {pendingPreviews.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {pendingPreviews.map((p) => (
              <li key={p.key} className="relative">
                {p.kind === "video" ? (
                  <video
                    src={p.previewUrl}
                    muted
                    className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : p.kind === "audio" ? (
                  <div className="flex h-16 w-44 flex-col justify-center gap-0.5 rounded-lg bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                    <span className="truncate text-[10px] font-medium text-slate-500">
                      {p.name}
                    </span>
                    <audio controls src={p.previewUrl} className="h-8 w-full" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.previewUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                )}
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
                  aria-label="Remove attachment"
                  onClick={() => removePending(p.key)}
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <SupportVoiceRecorder
          pending={null}
          onChange={(note) => {
            if (!note) return;
            addPendingFiles([pendingSupportVoiceToFile(note)], {
              allowAudio: true,
            });
            revokePendingSupportVoice(note);
          }}
          disabled={saving || pendingMedia.length >= COMMUNITY_POST_MEDIA_MAX}
          onError={setError}
          toolbar={(micButton) => (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-0.5">
                <label
                  className="inline-flex cursor-pointer rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  title="Add photo"
                >
                  <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
                  <span className="sr-only">Photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    disabled={pendingMedia.length >= COMMUNITY_POST_MEDIA_MAX}
                    onChange={(e) => {
                      addPendingFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                </label>
                <label
                  className="inline-flex cursor-pointer rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  title="Attach video"
                >
                  <Video className="h-4 w-4" strokeWidth={1.75} />
                  <span className="sr-only">Video</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.mov"
                    className="sr-only"
                    disabled={pendingMedia.length >= COMMUNITY_POST_MEDIA_MAX}
                    onChange={(e) => {
                      addPendingFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                </label>
                {micButton}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <label
                  className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-500"
                  title={
                    isAdminCreate
                      ? "Email the coach when support replies. Replies close together are sent in one email after a short pause."
                      : accountEmail
                        ? `Email ${accountEmail} when support replies. Replies close together are sent in one email after a short pause.`
                        : "Email me when support replies. Replies close together are sent in one email after a short pause."
                  }
                >
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-sky-600"
                  />
                  <span className="whitespace-nowrap">
                    {isAdminCreate ? "Email coach on reply" : "Email me on reply"}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void submit()}
                  className="rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {saving
                    ? isAdminCreate
                      ? "Creating…"
                      : "Sending…"
                    : isAdminCreate
                      ? "Create ticket"
                      : "Send ticket"}
                </button>
              </div>
            </div>
          )}
        />

        {error ? (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
