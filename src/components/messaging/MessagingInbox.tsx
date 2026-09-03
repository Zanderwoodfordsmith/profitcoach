"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Clock,
  Eye,
  Inbox,
  ListFilter,
  Loader2,
  Mail,
  MailOpen,
  Maximize2,
  Minimize2,
  Minus,
  Phone,
  RefreshCw,
  Search,
  Send,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import {
  formatDayLabel,
  formatShortDate,
  formatShortDateTime,
  formatShortTime,
} from "@/lib/formatShortDate";
import {
  conversationPersonName,
  inboundReplyChannels,
} from "@/lib/messaging/conversationDisplay";
import { supabaseClient } from "@/lib/supabaseClient";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import {
  ChatComposerTools,
  MessageAttachments,
  revokePendingFiles,
  ScheduleMessageModal,
  type PendingComposerFile,
  type PendingVideoNote,
  type PendingVoiceNote,
} from "@/components/messaging/ComposerMediaTools";

type InboxTab = "unread" | "all" | "recent" | "starred";
type ChannelFilter =
  | "all"
  | "linkedin"
  | "email"
  | "sms"
  | "whatsapp"
  | "instagram"
  | "messenger";
type InboxSort = "newest" | "oldest" | "unread";
type ReplyChannel =
  | "email"
  | "sms"
  | "whatsapp"
  | "comment"
  | "linkedin"
  | "instagram"
  | "messenger";

type ConversationRow = {
  id: string;
  subject: string | null;
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  prospect_avatar_url?: string | null;
  prospect_linkedin_url?: string | null;
  prospect_business_name?: string | null;
  last_message_at: string;
  contact_id?: string | null;
  booking_id?: string | null;
  starred?: boolean;
  unread_count?: number;
  last_preview?: string | null;
  last_channel?: string | null;
  reply_channels?: string[];
};

type MessageAttachment = {
  path?: string;
  mime: string;
  size?: number;
  filename: string;
  signedUrl?: string | null;
  kind?: string;
};

type MessageRow = {
  id: string;
  channel: string;
  direction: string;
  status: string;
  subject: string | null;
  body_text: string | null;
  from_address: string | null;
  to_address: string | null;
  provider_error: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  attachments?: MessageAttachment[];
};

/** Client-only outbound bubble shown while upload/send is in flight. */
type OptimisticMessage = MessageRow & {
  conversationId: string;
  localUrls: string[];
};

function isOptimisticId(id: string) {
  return id.startsWith("pending:");
}

type ProspectDetails = {
  id: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  business_name: string | null;
  linkedin_url?: string | null;
  phone: string | null;
  prospect_status: string | null;
  boss_score: number | null;
  boss_score_at: string | null;
  boss_score_premium: number | null;
  boss_score_premium_at: string | null;
  boss_level: string | null;
  revenue: string | null;
  team_size: string | null;
};

type BookingDetails = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: string | null;
  prospect_timezone: string | null;
  meeting_join_url: string | null;
  meeting_location_type: string | null;
};

type ActivityEvent = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail?: string | null;
  href?: string | null;
};

type FeedItem =
  | { kind: "message"; at: string; message: MessageRow }
  | { kind: "activity"; at: string; activity: ActivityEvent };

function previewText(body: string | null | undefined, max = 96): string {
  const compact = (body || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}…`;
}

function messageAttachmentsOf(m: MessageRow): MessageAttachment[] {
  if (m.attachments?.length) return m.attachments;
  const raw = m.metadata?.attachments;
  if (!Array.isArray(raw)) return [];
  const out: MessageAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const filename =
      typeof r.filename === "string"
        ? r.filename
        : typeof r.path === "string"
          ? r.path.split("/").pop() || "file"
          : "file";
    out.push({
      path: typeof r.path === "string" ? r.path : undefined,
      mime: typeof r.mime === "string" ? r.mime : "application/octet-stream",
      size: typeof r.size === "number" ? r.size : undefined,
      filename,
      signedUrl: typeof r.signedUrl === "string" ? r.signedUrl : null,
      kind: typeof r.kind === "string" ? r.kind : undefined,
    });
  }
  return out;
}

function initials(name: string | null | undefined): string {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function Avatar({
  name,
  url,
  size = "sm",
  tone = "neutral",
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "neutral" | "sky";
}) {
  const [broken, setBroken] = useState(false);
  const sizeClass =
    size === "lg" ? "h-16 w-16 text-lg" : size === "md" ? "h-9 w-9 text-[11px]" : "h-8 w-8 text-[10px]";
  const toneClass =
    tone === "sky"
      ? "bg-sky-100 text-sky-800 ring-sky-200/80"
      : "bg-slate-200 text-slate-700 ring-slate-200/80";
  const ringClass = tone === "sky" ? "ring-sky-200/80" : "ring-slate-200/80";
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ${ringClass}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ${sizeClass} ${toneClass}`}
    >
      {initials(name)}
    </span>
  );
}

function channelLabelOf(channel: string | null | undefined): string {
  const c = (channel || "").toLowerCase();
  if (c === "sms") return "SMS";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "instagram") return "Instagram";
  if (c === "messenger") return "Messenger";
  if (c === "system" || c === "comment") return "Internal Comment";
  if (c === "linkedin") return "LinkedIn";
  if (c === "email") return "Email";
  return "Message";
}

function ChannelMark({
  channel,
  size = "sm",
}: {
  channel: string | null | undefined;
  size?: "sm" | "md";
}) {
  const c = (channel || "").toLowerCase();
  const box = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (c === "linkedin") {
    return <LinkedInSolidIcon className={`${box} shrink-0`} />;
  }
  if (c === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" className={`${box} shrink-0`} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#25D366" />
        <path
          fill="#fff"
          d="M12 5.6A6.4 6.4 0 005.6 12c0 1.13.3 2.18.82 3.1L5.5 18.5l2.87-.9A6.37 6.37 0 0012 18.4 6.4 6.4 0 0012 5.6zm3.7 8.86c-.16.4-.8.77-1.12.82-.3.05-.66.07-1.06-.06-.24-.08-.55-.18-.95-.35-1.66-.72-2.75-2.4-2.83-2.51-.08-.11-.66-.88-.66-1.7 0-.8.4-1.19.55-1.35.15-.16.31-.2.41-.2h.29c.1 0 .23 0 .35.27.14.32.47 1.15.51 1.24.04.08.06.17 0 .28-.06.11-.1.18-.19.28l-.27.3c-.08.08-.19.17-.08.29.16.24.7.8 1.5 1.3.86.52 1.28.58 1.53.68.16.06.32.05.44-.08.13-.12.5-.58.64-.78.13-.2.26-.16.45-.1.18.07 1.15.54 1.35.64.2.1.33.15.38.23.04.09.04.47-.09.87z"
        />
      </svg>
    );
  }
  if (c === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={`${box} shrink-0`} aria-hidden>
        <rect width="24" height="24" rx="6" fill="#E4405F" />
        <rect
          x="6.2"
          y="6.2"
          width="11.6"
          height="11.6"
          rx="3.6"
          fill="none"
          stroke="#fff"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="12" r="2.7" fill="none" stroke="#fff" strokeWidth="1.7" />
        <circle cx="16.1" cy="7.9" r=".95" fill="#fff" />
      </svg>
    );
  }
  if (c === "messenger") {
    return (
      <svg viewBox="0 0 24 24" className={`${box} shrink-0`} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#0084FF" />
        <path
          fill="#fff"
          d="M12 6.4c-3.2 0-5.8 2.4-5.8 5.5 0 1.73.86 3.27 2.2 4.28V18.6l2.02-1.1c.5.14 1.03.22 1.58.22 3.2 0 5.8-2.4 5.8-5.5S15.2 6.4 12 6.4zm.58 7.4l-1.48-1.58-2.88 1.58 3.18-3.37 1.52 1.58 2.84-1.58-3.18 3.37z"
        />
      </svg>
    );
  }
  if (c === "sms") {
    return (
      <svg viewBox="0 0 24 24" className={`${box} shrink-0`} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#0c5290" />
        <path
          fill="#fff"
          d="M7.4 7.6h9.2c.72 0 1.3.58 1.3 1.3v5.2c0 .72-.58 1.3-1.3 1.3h-3.1l-2.5 2.1v-2.1H7.4c-.72 0-1.3-.58-1.3-1.3V8.9c0-.72.58-1.3 1.3-1.3z"
        />
      </svg>
    );
  }
  if (c === "comment") {
    return <Eye className={`${box} shrink-0 text-slate-500`} strokeWidth={2} aria-hidden />;
  }
  if (c === "system") {
    return (
      <svg viewBox="0 0 24 24" className={`${box} shrink-0`} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#d97706" />
        <path
          fill="#fff"
          d="M15.1 7.2l1.7 1.7-6.6 6.6H8.5v-1.7l6.6-6.6zM7.4 16.2h9.2v1.2H7.4v-1.2z"
        />
      </svg>
    );
  }
  if (c === "email") {
    return (
      <svg viewBox="0 0 24 24" className={`${box} shrink-0`} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#0c5290" />
        <path
          fill="#fff"
          d="M6.6 8.2l5.4 3.5 5.4-3.5v7.6c0 .55-.45 1-1 1H7.6c-.55 0-1-.45-1-1V8.2zm9.9-1.2H7.5L12 10.4 16.5 7z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={`${box} shrink-0`} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#475569" />
      <path
        fill="#fff"
        d="M6.6 8.2l5.4 3.5 5.4-3.5v7.6c0 .55-.45 1-1 1H7.6c-.55 0-1-.45-1-1V8.2zm9.9-1.2H7.5L12 10.4 16.5 7z"
      />
    </svg>
  );
}

function ChannelBadgeStack({
  channels,
  size = "sm",
}: {
  channels: string[] | null | undefined;
  size?: "sm" | "md";
}) {
  const unique = [...new Set((channels || []).filter(Boolean))];
  if (!unique.length) return null;
  const wrap =
    size === "md" ? "-bottom-0.5 -right-0.5" : "-bottom-px -right-px";
  const plusClass =
    size === "md"
      ? "h-4 min-w-4 px-0.5 text-[8px]"
      : "h-3.5 min-w-3.5 px-0.5 text-[7px]";

  if (unique.length === 1) {
    return (
      <span
        title={channelLabelOf(unique[0])}
        className={`absolute ${wrap} inline-flex leading-none`}
      >
        <ChannelMark channel={unique[0]} size={size} />
      </span>
    );
  }

  if (unique.length === 2) {
    return (
      <span
        title={`${channelLabelOf(unique[0])}, ${channelLabelOf(unique[1])}`}
        className={`absolute ${wrap} inline-flex leading-none`}
      >
        <span className="relative z-0 inline-flex leading-none">
          <ChannelMark channel={unique[1]} size={size} />
        </span>
        <span className="relative z-10 -ml-1.5 inline-flex leading-none">
          <ChannelMark channel={unique[0]} size={size} />
        </span>
      </span>
    );
  }

  return (
    <span
      title={unique.map(channelLabelOf).join(", ")}
      className={`absolute ${wrap} inline-flex items-end leading-none`}
    >
      <span
        className={`relative z-0 inline-flex items-center justify-center rounded-full bg-slate-800 font-bold leading-none text-white ${plusClass}`}
      >
        +{unique.length - 1}
      </span>
      <span className="relative z-10 -ml-1 inline-flex leading-none">
        <ChannelMark channel={unique[0]} size={size} />
      </span>
    </span>
  );
}

function ChannelViaLine({
  channel,
  href,
}: {
  channel: string | null | undefined;
  href?: string | null;
}) {
  const c = (channel || "").toLowerCase();
  if (!c || c === "system" || c === "comment") return null;
  const inner = (
    <>
      <ChannelMark channel={c} />
      {channelLabelOf(c)}
    </>
  );
  if (href && (c === "linkedin" || c === "instagram")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-800"
      >
        {inner}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      {inner}
    </span>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-3">
      <dt className="text-[15px] leading-snug text-slate-700">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] leading-snug text-slate-900">
        {children}
      </dd>
    </div>
  );
}

function DetailEmpty() {
  return <span className="text-slate-500">—</span>;
}

function CollapsibleDetailSection({
  title,
  open,
  onToggle,
  children,
  badge,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mb-2 flex w-full items-center gap-1.5 text-left"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
          strokeWidth={2}
        />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h4>
        {badge ? <span className="ml-auto">{badge}</span> : null}
      </button>
      {open ? children : null}
    </section>
  );
}

function BusinessNameField({
  value,
  onChange,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Add business name"
      aria-label="Business name"
      title="Edit business name"
      className="mt-0.5 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-0.5 text-[15px] leading-snug text-slate-800 outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-sky-500"
    />
  );
}

function AvatarWithChannels({
  name,
  url,
  size = "sm",
  tone = "neutral",
  channels,
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "neutral" | "sky";
  channels?: string[] | null;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={name} url={url} size={size} tone={tone} />
      <ChannelBadgeStack
        channels={channels}
        size={size === "lg" ? "md" : "sm"}
      />
    </span>
  );
}

function ChannelIcon({
  channel,
  className = "",
}: {
  channel: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      title={channelLabelOf(channel)}
      className={`inline-flex items-center justify-center ${className}`}
    >
      <ChannelMark channel={channel} />
      <span className="sr-only">{channelLabelOf(channel)}</span>
    </span>
  );
}

function composerChannelOptions(selected: {
  last_channel?: string | null;
  prospect_email?: string | null;
  prospect_phone?: string | null;
}): { id: ReplyChannel; label: string; enabled: boolean }[] {
  const last = (selected.last_channel || "").toLowerCase();
  return [
    { id: "sms", label: "SMS", enabled: Boolean(selected.prospect_phone) },
    { id: "whatsapp", label: "WhatsApp", enabled: last === "whatsapp" },
    {
      id: "email",
      label: "Email",
      enabled: Boolean(selected.prospect_email) || last === "email",
    },
    { id: "linkedin", label: "LinkedIn", enabled: last === "linkedin" },
    { id: "instagram", label: "Instagram", enabled: last === "instagram" },
    { id: "messenger", label: "Messenger", enabled: last === "messenger" },
    { id: "comment", label: "Internal Comment", enabled: true },
  ];
}

function ChannelPickerMenu({
  open,
  current,
  options,
  onPick,
}: {
  open: boolean;
  current: ReplyChannel;
  options: { id: ReplyChannel; label: string; enabled: boolean }[];
  onPick: (id: ReplyChannel) => void;
}) {
  if (!open) return null;
  return (
    <div
      role="menu"
      className="absolute bottom-full left-0 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
    >
      {options.map((item) => {
        const active = current === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={!item.enabled}
            onClick={() => {
              if (!item.enabled) return;
              onPick(item.id);
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
              !item.enabled
                ? "cursor-not-allowed text-slate-300"
                : active
                  ? "bg-sky-50 font-medium text-sky-800"
                  : "text-slate-800 hover:bg-slate-50"
            }`}
          >
            <ChannelMark channel={item.id} />
            <span className="min-w-0 flex-1">{item.label}</span>
            {active ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" strokeWidth={2.5} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MessageErrorBadge({
  message,
  align = "left",
}: {
  message: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-flex ${align === "right" ? "ml-auto" : ""}`}>
      <button
        type="button"
        title={message}
        aria-label="Delivery error"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-amber-600 hover:bg-amber-50 hover:text-amber-700"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <span
          role="tooltip"
          className={`absolute z-20 mt-1 w-56 rounded-md bg-slate-900 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          } top-full`}
        >
          {message}
        </span>
      ) : null}
    </span>
  );
}

function activityGlyph(type: string): string {
  switch (type) {
    case "boss_score_completed":
    case "boss_pro_completed":
    case "assessment_started":
      return "◎";
    case "call_booked":
      return "◷";
    case "form_filled":
      return "▣";
    case "prospect_created":
      return "✦";
    default:
      return "•";
  }
}

const TABS: {
  id: InboxTab;
  label: string;
  icon: typeof Mail;
}[] = [
  { id: "unread", label: "Unread", icon: Mail },
  { id: "all", label: "All", icon: Inbox },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "starred", label: "Starred", icon: Star },
];

const CHANNEL_FILTERS: { id: ChannelFilter; label: string }[] = [
  { id: "all", label: "All channels" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "messenger", label: "Messenger" },
  { id: "sms", label: "SMS" },
];

const SORT_OPTIONS: { id: InboxSort; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "unread", label: "Unread first" },
];

function conversationMatchesChannel(
  conversation: ConversationRow,
  channel: ChannelFilter
): boolean {
  if (channel === "all") return true;
  const last = (conversation.last_channel || "").toLowerCase();
  if (last === channel) return true;
  return (conversation.reply_channels || []).some(
    (item) => item.toLowerCase() === channel
  );
}

function inboxEmptyCopy(
  tab: InboxTab,
  channel: ChannelFilter,
  searching: boolean
): string {
  if (searching) return "No conversations match that search.";
  if (tab === "unread") return "No unread conversations.";
  if (tab === "starred") return "No starred conversations.";
  if (channel === "linkedin") {
    return "No LinkedIn threads yet. Connect LinkedIn in Settings → Integrations, then Sync.";
  }
  if (channel === "email") {
    return "No email threads yet. Connect Gmail or Outlook in Settings → Integrations, then Sync.";
  }
  if (channel === "whatsapp") {
    return "No WhatsApp threads yet. Connect WhatsApp in Settings → Integrations, then Sync.";
  }
  if (channel === "instagram") {
    return "No Instagram threads yet. Connect Instagram in Settings → Integrations, then Sync.";
  }
  if (channel === "messenger") {
    return "No Messenger threads yet. Connect Facebook Messenger in Settings → Integrations, then Sync.";
  }
  if (channel === "sms") return "No SMS threads yet.";
  if (tab === "recent") return "No recent conversations.";
  return "No conversations yet. Book a call to create the first thread.";
}

function conversationMatchesSearch(
  conversation: ConversationRow,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const name = conversationPersonName({
    prospectName: conversation.prospect_name,
    prospectEmail: conversation.prospect_email,
    channel: conversation.last_channel,
  }).toLowerCase();
  const hay = [
    name,
    conversation.prospect_name,
    conversation.prospect_email,
    conversation.prospect_phone,
    conversation.subject,
    conversation.last_preview,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function MessagingInbox() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
      overscroll: html.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";
    html.style.overscrollBehavior = "none";
    html.scrollTop = 0;
    body.scrollTop = 0;

    const scrollableAncestor = (target: EventTarget | null) => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== document.body) {
        const overflowY = getComputedStyle(node).overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const onWheel = (event: WheelEvent) => {
      const pane = scrollableAncestor(event.target);
      if (!pane) {
        event.preventDefault();
        return;
      }
      const atTop = pane.scrollTop <= 0 && event.deltaY < 0;
      const atBottom =
        pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1 &&
        event.deltaY > 0;
      if (atTop || atBottom) event.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.height = prev.htmlHeight;
      body.style.height = prev.bodyHeight;
      html.style.overscrollBehavior = prev.overscroll;
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [prospectDetails, setProspectDetails] = useState<ProspectDetails | null>(
    null
  );
  const [businessDraft, setBusinessDraft] = useState("");
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(
    null
  );
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<InboxTab>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [inboxSort, setInboxSort] = useState<InboxSort>("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  /** Keep the viewport glued to the newest message until the user scrolls up. */
  const pinThreadToBottomRef = useRef(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [replyChannel, setReplyChannel] = useState<ReplyChannel>("email");
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [scheduleSending, setScheduleSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingComposerFile[]>([]);
  const [pendingVoice, setPendingVoice] = useState<PendingVoiceNote | null>(
    null
  );
  const [pendingVideo, setPendingVideo] = useState<PendingVideoNote | null>(
    null
  );
  const [optimisticMessages, setOptimisticMessages] = useState<
    OptimisticMessage[]
  >([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [detailSectionsOpen, setDetailSectionsOpen] = useState({
    assessment: true,
    booking: true,
    conversation: true,
    notes: true,
  });
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [coachProfile, setCoachProfile] = useState<{
    name: string;
    avatarUrl: string | null;
  }>({ name: "You", avatarUrl: null });
  const [liSyncing, setLiSyncing] = useState(false);
  const [liSyncNote, setLiSyncNote] = useState<string | null>(null);
  const liSoftSyncAttempted = useRef(false);

  const selected = useMemo(
    () =>
      conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const unreadTotal = useMemo(
    () =>
      conversations.filter(
        (c) =>
          conversationMatchesChannel(c, channelFilter) &&
          (c.unread_count ?? 0) > 0
      ).length,
    [conversations, channelFilter]
  );

  const filtered = useMemo(() => {
    let list = conversations.filter((c) =>
      conversationMatchesChannel(c, channelFilter)
    );
    if (tab === "unread") list = list.filter((c) => (c.unread_count ?? 0) > 0);
    if (tab === "starred") list = list.filter((c) => !!c.starred);
    if (searchQuery.trim()) {
      list = list.filter((c) => conversationMatchesSearch(c, searchQuery));
    }
    list = [...list].sort((a, b) => {
      const byDate =
        new Date(b.last_message_at).getTime() -
        new Date(a.last_message_at).getTime();
      if (inboxSort === "oldest") return -byDate;
      if (inboxSort === "unread") {
        const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0;
        const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
      }
      return byDate;
    });
    if (tab === "recent") return list.slice(0, 20);
    return list;
  }, [conversations, tab, channelFilter, inboxSort, searchQuery]);

  useEffect(() => {
    if (!filterOpen && !sortOpen && !actionsOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        filterOpen &&
        filterMenuRef.current &&
        !filterMenuRef.current.contains(target)
      ) {
        setFilterOpen(false);
      }
      if (
        sortOpen &&
        sortMenuRef.current &&
        !sortMenuRef.current.contains(target)
      ) {
        setSortOpen(false);
      }
      if (
        actionsOpen &&
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(target)
      ) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [filterOpen, sortOpen, actionsOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFilterOpen(false);
      setSortOpen(false);
      setActionsOpen(false);
      if (searchOpen) {
        if (searchQuery) setSearchQuery("");
        else setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen, searchQuery]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const checkedCount = checkedIds.size;
  const allVisibleChecked =
    filtered.length > 0 && filtered.every((c) => checkedIds.has(c.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = checkedCount > 0 && !allVisibleChecked;
  }, [checkedCount, allVisibleChecked]);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError("Sign in again, then retry.");
        return;
      }
      const res = await fetch("/api/messaging/conversations", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        conversations?: ConversationRow[];
      };
      if (!res.ok) {
        setError(body.error || `Request failed (${res.status}).`);
        setConversations([]);
        return;
      }
      const list = Array.isArray(body.conversations) ? body.conversations : [];
      setConversations(list);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const loadThread = useCallback(
    async (id: string) => {
      setLoadingThread(true);
      setProspectDetails(null);
      setBookingDetails(null);
      setActivityEvents([]);
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const res = await fetch(
          `/api/messaging/conversations/${encodeURIComponent(id)}`,
          { headers }
        );
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          conversation?: ConversationRow;
          messages?: MessageRow[];
          prospect?: ProspectDetails | null;
          booking?: BookingDetails | null;
          activity?: ActivityEvent[];
        };
        if (!res.ok) {
          setError(body.error || `Thread failed (${res.status}).`);
          setMessages([]);
          setProspectDetails(null);
          setBookingDetails(null);
          setActivityEvents([]);
          setExpandedIds(new Set());
          return;
        }
        const list = Array.isArray(body.messages) ? body.messages : [];
        setMessages(list);
        setProspectDetails(body.prospect ?? null);
        setBookingDetails(body.booking ?? null);
        setActivityEvents(Array.isArray(body.activity) ? body.activity : []);
        const newest = list[list.length - 1];
        setExpandedIds(newest ? new Set([newest.id]) : new Set());
        if (body.conversation) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === id
                ? { ...c, ...body.conversation, unread_count: 0 }
                : c
            )
          );
          if (body.conversation.subject) {
            setReplySubject((s) => s || `Re: ${body.conversation!.subject}`);
          }
        } else {
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Thread load failed.");
      } finally {
        setLoadingThread(false);
      }
    },
    [authHeaders]
  );

  const syncLinkedInInbox = useCallback(
    async (force: boolean) => {
      setLiSyncing(true);
      setLiSyncNote(null);
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const res = await fetch("/api/coach/linkedin-outreach/inbox-sync", {
          method: "POST",
          headers,
          body: JSON.stringify({ force }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          skipped?: boolean;
          reason?: string;
          chats?: number;
          messages?: number;
        };
        if (!res.ok) {
          if (!force && (res.status === 401 || res.status === 403)) return;
          setLiSyncNote(body.error || "LinkedIn sync failed.");
          return;
        }
        if (body.skipped) {
          if (force) {
            setLiSyncNote(
              body.reason === "no_account"
                ? "Connect LinkedIn in Campaigns first."
                : "Synced very recently — try again in a minute."
            );
          }
          if ((body.chats ?? 0) > 0) {
            await loadList();
            if (selectedId) await loadThread(selectedId);
          }
          return;
        }
        setLiSyncNote(
          `Synced ${body.chats ?? 0} chats · ${body.messages ?? 0} new messages`
        );
        await loadList();
        if (selectedId) await loadThread(selectedId);
      } catch {
        if (force) setLiSyncNote("LinkedIn sync failed.");
      } finally {
        setLiSyncing(false);
      }
    },
    [authHeaders, loadList, loadThread, selectedId]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setCheckedIds((prev) => {
      if (filtered.every((c) => prev.has(c.id)) && filtered.length > 0) {
        return new Set();
      }
      return new Set(filtered.map((c) => c.id));
    });
  }, [filtered]);

  const patchConversation = useCallback(
    async (
      id: string,
      patch: { starred?: boolean; unread_count?: number; business_name?: string | null }
    ) => {
      const headers = await authHeaders();
      if (!headers) return;
      if (patch.starred !== undefined || patch.unread_count !== undefined) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
        );
      }
      const res = await fetch(
        `/api/messaging/conversations/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(patch),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        conversation?: { prospect_business_name?: string | null };
        prospect?: { business_name?: string | null };
      };
      if (patch.business_name !== undefined) {
        const saved =
          body.prospect?.business_name ??
          body.conversation?.prospect_business_name ??
          patch.business_name;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, prospect_business_name: saved } : c
          )
        );
        setProspectDetails((prev) =>
          prev ? { ...prev, business_name: saved ?? null } : prev
        );
      }
    },
    [authHeaders]
  );

  const applyBulkAction = useCallback(
    async (
      action:
        | "read"
        | "unread"
        | "star"
        | "unstar"
        | "delete"
    ) => {
      const ids = [...checkedIds];
      if (!ids.length || bulkBusy) return;
      if (action === "delete") {
        const noun = ids.length === 1 ? "conversation" : "conversations";
        if (
          !window.confirm(
            `Delete ${ids.length} ${noun}? They will leave this inbox.`
          )
        ) {
          return;
        }
      }
      const headers = await authHeaders();
      if (!headers) return;
      setBulkBusy(true);
      setActionsOpen(false);
      try {
        if (action === "delete") {
          await Promise.all(
            ids.map((id) =>
              fetch(`/api/messaging/conversations/${encodeURIComponent(id)}`, {
                method: "DELETE",
                headers,
              })
            )
          );
          const removed = new Set(ids);
          setConversations((prev) => {
            const remaining = prev.filter((c) => !removed.has(c.id));
            setSelectedId((cur) =>
              cur && removed.has(cur) ? remaining[0]?.id ?? null : cur
            );
            return remaining;
          });
          setCheckedIds(new Set());
          return;
        }
        const patch =
          action === "read"
            ? { unread_count: 0 }
            : action === "unread"
              ? { unread_count: 1 }
              : action === "star"
                ? { starred: true }
                : { starred: false };
        setConversations((prev) =>
          prev.map((c) => (ids.includes(c.id) ? { ...c, ...patch } : c))
        );
        await Promise.all(
          ids.map((id) =>
            fetch(`/api/messaging/conversations/${encodeURIComponent(id)}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(patch),
            })
          )
        );
      } finally {
        setBulkBusy(false);
      }
    },
    [authHeaders, bulkBusy, checkedIds]
  );

  const mediaComposerEnabled =
    replyChannel === "linkedin" ||
    replyChannel === "whatsapp" ||
    replyChannel === "instagram" ||
    replyChannel === "messenger";

  const clearPendingFiles = useCallback(() => {
    setPendingFiles((prev) => {
      revokePendingFiles(prev);
      return [];
    });
    setPendingVoice((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setPendingVideo((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const dismissOptimistic = useCallback((id: string) => {
    setOptimisticMessages((prev) => {
      const victim = prev.find((m) => m.id === id);
      if (victim) {
        for (const url of victim.localUrls) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            /* ignore */
          }
        }
      }
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const addPendingFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const next: PendingComposerFile[] = [];
      for (const file of Array.from(list)) {
        if (pendingFiles.length + next.length >= 5) break;
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : null,
        });
      }
      if (next.length) setPendingFiles((prev) => [...prev, ...next].slice(0, 5));
    },
    [pendingFiles.length]
  );

  const insertEmojiAtCursor = useCallback((emoji: string) => {
    const el = replyTextareaRef.current;
    if (!el) {
      setReplyBody((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? replyBody.length;
    const end = el.selectionEnd ?? replyBody.length;
    const next = replyBody.slice(0, start) + emoji + replyBody.slice(end);
    setReplyBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }, [replyBody]);

  const scrollThreadToBottom = useCallback(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    threadBottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    // Layout can settle a frame later (avatars, images, fonts).
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const sendReply = useCallback(
    async (opts?: { scheduledFor?: string }) => {
      if (!selected?.id) return;
      if (
        !replyBody.trim() &&
        pendingFiles.length === 0 &&
        !pendingVoice &&
        !pendingVideo
      ) {
        return;
      }

      const conversationId = selected.id;
      const bodyText = replyBody;
      const subjectText = replySubject;
      const fromNameText = fromName;
      const filesSnap = pendingFiles;
      const voiceSnap = pendingVoice;
      const videoSnap = pendingVideo;
      const channel =
        replyChannel === "comment" ? "comment" : replyChannel;
      const useMultipart =
        filesSnap.length > 0 ||
        Boolean(voiceSnap) ||
        Boolean(videoSnap) ||
        Boolean(opts?.scheduledFor);

      // Snapshot media into the thread immediately (except schedule — no bubble yet).
      let optimisticId: string | null = null;
      const localUrls: string[] = [];
      if (!opts?.scheduledFor) {
        const attachments: MessageAttachment[] = [];
        for (const p of filesSnap) {
          const url =
            p.previewUrl ||
            (p.file.type || p.file.size
              ? URL.createObjectURL(p.file)
              : null);
          if (url && url !== p.previewUrl) localUrls.push(url);
          if (p.previewUrl) localUrls.push(p.previewUrl);
          attachments.push({
            mime: p.file.type || "application/octet-stream",
            size: p.file.size,
            filename: p.file.name,
            signedUrl: url,
          });
        }
        if (voiceSnap) {
          localUrls.push(voiceSnap.url);
          attachments.push({
            mime: voiceSnap.mime || "audio/webm",
            size: voiceSnap.blob.size,
            filename: voiceSnap.filename,
            signedUrl: voiceSnap.url,
            kind: "voice",
          });
        }
        if (videoSnap) {
          localUrls.push(videoSnap.url);
          attachments.push({
            mime: videoSnap.file.type || "video/mp4",
            size: videoSnap.file.size,
            filename: videoSnap.file.name,
            signedUrl: videoSnap.url,
            kind: "video",
          });
        }

        optimisticId = `pending:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimistic: OptimisticMessage = {
          id: optimisticId,
          conversationId,
          localUrls: [...new Set(localUrls)],
          channel,
          direction: "outbound",
          status: "sending",
          subject: subjectText || null,
          body_text: bodyText.trim() || null,
          from_address: null,
          to_address: null,
          provider_error: null,
          created_at: new Date().toISOString(),
          attachments,
          metadata: attachments.length
            ? { attachments }
            : null,
        };
        setOptimisticMessages((prev) => [...prev, optimistic]);
        setExpandedIds((prev) => new Set(prev).add(optimisticId!));
        pinThreadToBottomRef.current = true;
        requestAnimationFrame(() => scrollThreadToBottom());

        // Free the composer right away — don't wait on upload.
        setPendingFiles([]);
        setPendingVoice(null);
        setPendingVideo(null);
        setReplyBody("");
        setComposerOpen(false);
        setComposerExpanded(false);
        setScheduleOpen(false);
        setSendError(null);
      } else {
        setScheduleSending(true);
        setSendError(null);
        setScheduleNotice(null);
      }

      try {
        const headers = await authHeaders();
        if (!headers) {
          const err = "Sign in again, then retry.";
          if (optimisticId) {
            setOptimisticMessages((prev) =>
              prev.map((m) =>
                m.id === optimisticId
                  ? { ...m, status: "failed", provider_error: err }
                  : m
              )
            );
          } else {
            setSendError(err);
          }
          return;
        }

        let res: Response;
        if (useMultipart) {
          const form = new FormData();
          form.append("channel", channel);
          form.append("body", bodyText);
          if (subjectText) form.append("subject", subjectText);
          if (fromNameText) form.append("fromName", fromNameText);
          if (opts?.scheduledFor) {
            form.append("scheduled_for", opts.scheduledFor);
          }
          for (const p of filesSnap) {
            form.append("attachments", p.file, p.file.name);
          }
          if (voiceSnap) {
            form.append(
              "voice_message",
              voiceSnap.blob,
              voiceSnap.filename
            );
          }
          if (videoSnap) {
            form.append(
              "video_message",
              videoSnap.file,
              videoSnap.file.name
            );
          }
          const { Authorization } = headers as Record<string, string>;
          res = await fetch(
            `/api/messaging/conversations/${encodeURIComponent(conversationId)}`,
            {
              method: "POST",
              headers: Authorization ? { Authorization } : {},
              body: form,
            }
          );
        } else {
          res = await fetch(
            `/api/messaging/conversations/${encodeURIComponent(conversationId)}`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                channel,
                body: bodyText,
                subject: subjectText || undefined,
                fromName: fromNameText || undefined,
              }),
            }
          );
        }

        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: MessageRow;
          scheduled?: { scheduled_for?: string };
        };
        if (!res.ok) {
          const err = body.error || `Send failed (${res.status}).`;
          if (optimisticId) {
            setOptimisticMessages((prev) =>
              prev.map((m) =>
                m.id === optimisticId
                  ? {
                      ...m,
                      status: "failed",
                      provider_error: err,
                    }
                  : m
              )
            );
            if (body.message && selectedId === conversationId) {
              setMessages((prev) => [...prev, body.message!]);
            }
          } else {
            setSendError(err);
            if (body.message) {
              setMessages((prev) => [...prev, body.message!]);
            }
          }
          return;
        }
        if (opts?.scheduledFor && body.scheduled) {
          clearPendingFiles();
          setReplyBody("");
          setComposerOpen(false);
          setComposerExpanded(false);
          setScheduleOpen(false);
          setScheduleNotice(
            `Scheduled for ${formatShortDateTime(opts.scheduledFor)}.`
          );
          return;
        }
        if (body.message) {
          if (optimisticId) {
            setOptimisticMessages((prev) => {
              const victim = prev.find((m) => m.id === optimisticId);
              if (victim) {
                for (const url of victim.localUrls) {
                  try {
                    URL.revokeObjectURL(url);
                  } catch {
                    /* ignore */
                  }
                }
              }
              return prev.filter((m) => m.id !== optimisticId);
            });
          }
          if (selectedId === conversationId) {
            setMessages((prev) => [...prev, body.message!]);
            setExpandedIds((prev) => new Set(prev).add(body.message!.id));
          }
        } else if (optimisticId) {
          dismissOptimistic(optimisticId);
        }
        if (opts?.scheduledFor) {
          clearPendingFiles();
          setReplyBody("");
          setComposerOpen(false);
          setComposerExpanded(false);
          setScheduleOpen(false);
        }
        await loadList();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Send failed.";
        if (optimisticId) {
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId
                ? { ...m, status: "failed", provider_error: msg }
                : m
            )
          );
        } else {
          setSendError(msg);
        }
      } finally {
        setScheduleSending(false);
      }
    },
    [
      authHeaders,
      clearPendingFiles,
      dismissOptimistic,
      fromName,
      loadList,
      pendingFiles,
      pendingVideo,
      pendingVoice,
      replyBody,
      replyChannel,
      replySubject,
      selected?.id,
      selectedId,
      scrollThreadToBottom,
    ]
  );

  useEffect(() => {
    clearPendingFiles();
    setScheduleNotice(null);
    setSendError(null);
    setComposerExpanded(false);
  }, [selectedId, clearPendingFiles]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Soft LinkedIn pull on first inbox view this session (server enforces 2h cooldown).
  useEffect(() => {
    if (liSoftSyncAttempted.current) return;
    liSoftSyncAttempted.current = true;
    void syncLinkedInInbox(false);
  }, [syncLinkedInInbox]);

  useEffect(() => {
    let cancelled = false;
    async function loadCoach() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabaseClient
        .from("profiles")
        .select("full_name, first_name, last_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const name =
        (data.full_name as string | null)?.trim() ||
        [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
        "You";
      setCoachProfile({
        name,
        avatarUrl: (data.avatar_url as string | null) ?? null,
      });
      setFromName((prev) => prev || name);
    }
    void loadCoach();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const headers = await authHeaders();
        if (!headers || cancelled) return;
        const [, inboundRes] = await Promise.all([
          fetch("/api/cron/booking-reminders", { headers }),
          fetch("/api/cron/bird-inbound", { headers }),
        ]);
        const inbound = (await inboundRes.json().catch(() => ({}))) as {
          ingested?: number;
        };
        if (!cancelled && (inbound.ingested ?? 0) > 0) {
          await loadList();
          if (selectedId) await loadThread(selectedId);
        }
      } catch {
        /* ignore */
      }
    }
    void tick();
    const id = window.setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [authHeaders, loadList, loadThread, selectedId]);

  useEffect(() => {
    if (selected?.id) {
      setComposerOpen(false);
      setChannelMenuOpen(false);
      setSendError(null);
      setReplyBody("");
      setReplySubject(
        selected.subject ? `Re: ${selected.subject}` : ""
      );
      void loadThread(selected.id);
    }
  }, [selected?.id, loadThread, selected?.subject]);

  useEffect(() => {
    if (!selected) return;
    const last = (selected.last_channel || "").toLowerCase();
    if (
      last === "linkedin" ||
      last === "whatsapp" ||
      last === "instagram" ||
      last === "messenger" ||
      last === "email"
    ) {
      setReplyChannel(last as ReplyChannel);
      return;
    }
    if (replyChannel === "sms" && !selected.prospect_phone) {
      setReplyChannel("email");
    }
    if (
      replyChannel === "email" &&
      !selected.prospect_email &&
      selected.prospect_phone
    ) {
      setReplyChannel("sms");
    }
  }, [selected, replyChannel]);

  const feedByDay = useMemo(() => {
    const optimisticForThread = selectedId
      ? optimisticMessages.filter((m) => m.conversationId === selectedId)
      : [];
    const items: FeedItem[] = [
      ...messages.map(
        (message): FeedItem => ({
          kind: "message",
          at: message.created_at,
          message,
        })
      ),
      ...optimisticForThread.map(
        (message): FeedItem => ({
          kind: "message",
          at: message.created_at,
          message,
        })
      ),
      ...activityEvents.map(
        (activity): FeedItem => ({
          kind: "activity",
          at: activity.at,
          activity,
        })
      ),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const groups: { label: string; items: FeedItem[] }[] = [];
    for (const item of items) {
      const label = formatDayLabel(item.at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [messages, activityEvents, optimisticMessages, selectedId]);

  useEffect(() => {
    pinThreadToBottomRef.current = true;
  }, [selectedId]);

  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el || loadingThread) return;

    const stickIfPinned = () => {
      if (!pinThreadToBottomRef.current) return;
      scrollThreadToBottom();
    };

    stickIfPinned();
    const raf = requestAnimationFrame(() => {
      stickIfPinned();
      requestAnimationFrame(stickIfPinned);
    });
    // Catch late layout from images / signed media / fonts.
    const t1 = window.setTimeout(stickIfPinned, 80);
    const t2 = window.setTimeout(stickIfPinned, 250);
    const t3 = window.setTimeout(stickIfPinned, 600);

    const content = el.firstElementChild;
    let ro: ResizeObserver | null = null;
    if (content && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => stickIfPinned());
      ro.observe(content);
    }

    const onScroll = () => {
      const distFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      // Only unpin when the user clearly scrolls away from the bottom.
      pinThreadToBottomRef.current = distFromBottom < 96;
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    const onMediaLoad = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) && !(target instanceof HTMLVideoElement)) {
        return;
      }
      if (!el.contains(target)) return;
      stickIfPinned();
    };
    el.addEventListener("load", onMediaLoad, true);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      ro?.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("load", onMediaLoad, true);
    };
  }, [
    selectedId,
    messages.length,
    loadingThread,
    feedByDay.length,
    optimisticMessages.length,
    scrollThreadToBottom,
  ]);

  const noteCount = useMemo(
    () => messages.filter((m) => m.channel === "system").length,
    [messages]
  );
  const noteMessages = useMemo(
    () => messages.filter((m) => m.channel === "system").slice(-8).reverse(),
    [messages]
  );

  const toggleDetailSection = useCallback(
    (key: keyof typeof detailSectionsOpen) => {
      setDetailSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  const displayName = conversationPersonName({
    prospectFullName: prospectDetails?.full_name,
    prospectName: selected?.prospect_name,
    prospectEmail: selected?.prospect_email,
    channel: selected?.last_channel,
  });
  const prospectAvatarUrl = selected?.prospect_avatar_url || null;
  const replyChannels = useMemo(() => {
    if (messages.length) {
      return inboundReplyChannels(messages, selected?.last_channel);
    }
    if (selected?.reply_channels?.length) return selected.reply_channels;
    return inboundReplyChannels([], selected?.last_channel);
  }, [messages, selected]);
  const speakingChannel =
    replyChannels[0] || selected?.last_channel || null;

  const subtitle =
    prospectDetails?.business_name?.trim() ||
    selected?.prospect_business_name?.trim() ||
    null;

  const email =
    prospectDetails?.email || selected?.prospect_email || null;
  const phone =
    prospectDetails?.phone || selected?.prospect_phone || null;
  const linkedIn =
    prospectDetails?.linkedin_url?.trim() ||
    selected?.prospect_linkedin_url?.trim() ||
    null;

  useEffect(() => {
    setBusinessDraft(
      prospectDetails?.business_name?.trim() ||
        selected?.prospect_business_name?.trim() ||
        ""
    );
  }, [
    selected?.id,
    prospectDetails?.business_name,
    selected?.prospect_business_name,
  ]);

  const saveBusinessName = useCallback(async () => {
    if (!selected?.id) return;
    const next = businessDraft.trim() || null;
    const current =
      prospectDetails?.business_name?.trim() ||
      selected.prospect_business_name?.trim() ||
      null;
    if (next === current) return;
    setProspectDetails((prev) =>
      prev ? { ...prev, business_name: next } : prev
    );
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selected.id ? { ...c, prospect_business_name: next } : c
      )
    );
    await patchConversation(selected.id, { business_name: next });
  }, [
    selected?.id,
    selected?.prospect_business_name,
    businessDraft,
    prospectDetails?.business_name,
    patchConversation,
  ]);

  const prospectHref = selected?.contact_id
    ? pathname?.startsWith("/admin")
      ? `/admin/prospects/${selected.contact_id}`
      : `/coach/prospects/${selected.contact_id}`
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col py-3 max-lg:h-auto max-lg:py-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white max-lg:min-h-[28rem]">
        <div className="grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,25%)_minmax(0,1fr)] xl:grid-cols-[minmax(0,25%)_minmax(0,50%)_minmax(0,25%)]">
          {/* Left: inbox list */}
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-200 max-lg:max-h-[40vh] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            {searchOpen ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200 focus-within:ring-sky-400">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  aria-label="Search conversations"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
                Inbox
              </h2>
            )}
            <div className="flex shrink-0 items-center">
              {searchOpen ? null : (
                <button
                  type="button"
                  aria-label="Search conversations"
                  onClick={() => {
                    setSearchOpen(true);
                    setFilterOpen(false);
                    setSortOpen(false);
                  }}
                  className="relative rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                >
                  <Search className="h-4 w-4" strokeWidth={1.75} />
                  {searchQuery.trim() ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-600" />
                  ) : null}
                </button>
              )}
              <div className="relative" ref={filterMenuRef}>
                <button
                  type="button"
                  aria-label="Filter by channel"
                  aria-expanded={filterOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setFilterOpen((open) => !open);
                    setSortOpen(false);
                  }}
                  className="relative rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                >
                  <ListFilter className="h-4 w-4" strokeWidth={1.75} />
                  {channelFilter !== "all" ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-600" />
                  ) : null}
                </button>
                {filterOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
                  >
                    {CHANNEL_FILTERS.map((item) => {
                      const active = channelFilter === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            setChannelFilter(item.id);
                            setFilterOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${
                            active
                              ? "bg-sky-50 font-medium text-sky-800"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {item.id === "all" ? (
                            <Inbox className="h-3.5 w-3.5 text-slate-400" />
                          ) : (
                            <ChannelMark channel={item.id} />
                          )}
                          {item.label}
                        </button>
                      );
                    })}
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setFilterOpen(false);
                        void syncLinkedInInbox(true);
                      }}
                      disabled={liSyncing || loading}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                      {liSyncing ? "Syncing…" : "Sync inbox"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="relative" ref={sortMenuRef}>
                <button
                  type="button"
                  aria-label="Sort conversations"
                  aria-expanded={sortOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setSortOpen((open) => !open);
                    setFilterOpen(false);
                  }}
                  className="relative rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                >
                  <ArrowUpDown className="h-4 w-4" strokeWidth={1.75} />
                  {inboxSort !== "newest" ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-600" />
                  ) : null}
                </button>
                {sortOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
                  >
                    {SORT_OPTIONS.map((item) => {
                      const active = inboxSort === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            setInboxSort(item.id);
                            setSortOpen(false);
                          }}
                          className={`flex w-full px-3 py-1.5 text-left text-[13px] ${
                            active
                              ? "bg-sky-50 font-medium text-sky-800"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSortOpen(false);
                        void loadList();
                      }}
                      disabled={loading}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                      {loading ? "Refreshing…" : "Refresh list"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 border-b border-slate-100">
            {TABS.map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              const badge =
                item.id === "unread" && unreadTotal > 0 ? unreadTotal : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[11px] font-medium ${
                    active
                      ? "text-sky-700"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {badge != null ? (
                      <span className="absolute -right-2.5 -top-1.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-sky-600 px-0.5 text-[8px] font-semibold leading-none text-white">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </span>
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-sky-600" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {checkedCount > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleChecked}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-sky-600"
                />
                <span className="font-medium">
                  {checkedCount} selected
                </span>
              </label>
              <div className="relative" ref={actionsMenuRef}>
                <button
                  type="button"
                  aria-expanded={actionsOpen}
                  aria-haspopup="menu"
                  disabled={bulkBusy}
                  onClick={() => {
                    setActionsOpen((open) => !open);
                    setFilterOpen(false);
                    setSortOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Actions
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                {actionsOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
                  >
                    {(
                      [
                        ["read", "Mark as read", MailOpen],
                        ["unread", "Mark as unread", Mail],
                        ["star", "Add star", Star],
                        ["unstar", "Remove star", StarOff],
                        ["delete", "Delete conversations", Trash2],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        type="button"
                        role="menuitem"
                        disabled={bulkBusy}
                        onClick={() => void applyBulkAction(id)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Icon className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleChecked}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-sky-600"
                />
                Select all
              </label>
              {liSyncNote ? (
                <span className="text-slate-600">{liSyncNote}</span>
              ) : null}
              {error ? <span className="text-red-600">{error}</span> : null}
            </div>
          )}

          <ul className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
            {filtered.length === 0 && !loading ? (
              <li className="px-4 py-8 text-sm text-slate-500">
                {inboxEmptyCopy(tab, channelFilter, Boolean(searchQuery.trim()))}
              </li>
            ) : null}
            {filtered.map((c) => {
              const active = selected?.id === c.id;
              const unread = (c.unread_count ?? 0) > 0;
              const checked = checkedIds.has(c.id);
              const personName = conversationPersonName({
                prospectName: c.prospect_name,
                prospectEmail: c.prospect_email,
                channel: c.last_channel,
              });
              return (
                <li key={c.id} className="px-2.5 py-0.5">
                  <div
                    className={`flex items-start gap-2 rounded-lg px-2 py-2 ${
                      checked
                        ? "bg-sky-50 ring-1 ring-sky-300"
                        : active
                          ? "bg-sky-50/80"
                          : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedIds.has(c.id)}
                      onChange={() => toggleChecked(c.id)}
                      className="mt-2.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-sky-600"
                      aria-label={`Select ${personName}`}
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start gap-2.5">
                        <AvatarWithChannels
                          name={personName}
                          url={c.prospect_avatar_url}
                          size="md"
                          channels={
                            c.reply_channels?.length
                              ? c.reply_channels
                              : c.last_channel
                                ? [c.last_channel]
                                : []
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`truncate text-sm ${
                                unread
                                  ? "font-semibold text-slate-900"
                                  : "font-medium text-slate-800"
                              }`}
                            >
                              {personName}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {previewText(c.last_preview || c.subject, 72) ||
                              "No messages yet"}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[11px] text-slate-400">
                            {formatShortDate(c.last_message_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            {unread ? (
                              <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold text-white">
                                {c.unread_count}
                              </span>
                            ) : null}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                void patchConversation(c.id, {
                                  starred: !c.starred,
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void patchConversation(c.id, {
                                    starred: !c.starred,
                                  });
                                }
                              }}
                              className={`text-sm ${
                                c.starred
                                  ? "text-amber-500"
                                  : "text-slate-300 hover:text-slate-500"
                              }`}
                              aria-label={c.starred ? "Unstar" : "Star"}
                            >
                              {c.starred ? "★" : "☆"}
                            </span>
                          </span>
                        </span>
                      </div>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Center: thread + composer */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden max-lg:h-[min(70dvh,36rem)] lg:min-h-0 lg:border-b-0 xl:border-b-0">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            {selected ? (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarWithChannels
                    name={displayName}
                    url={prospectAvatarUrl}
                    size="md"
                    channels={replyChannels}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {displayName}
                    </div>
                    {subtitle ? (
                      <div className="truncate text-[13px] text-slate-700">
                        {subtitle}
                      </div>
                    ) : null}
                    <div className="mt-0.5">
                      <ChannelViaLine
                        channel={speakingChannel}
                        href={linkedIn}
                      />
                    </div>
                    <div className="truncate text-xs text-slate-500 xl:hidden">
                      {[selected.prospect_email, selected.prospect_phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(selected.unread_count ?? 0) === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        void patchConversation(selected.id, { unread_count: 1 })
                      }
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    >
                      Mark unread
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      void patchConversation(selected.id, {
                        starred: !selected.starred,
                      })
                    }
                    className={`rounded-md px-2 py-1 text-lg ${
                      selected.starred ? "text-amber-500" : "text-slate-300"
                    }`}
                    aria-label={selected.starred ? "Unstar" : "Star"}
                  >
                    {selected.starred ? "★" : "☆"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Select a conversation</div>
            )}
          </div>

          <div
            ref={threadScrollRef}
            className={`flex min-h-0 flex-col overflow-y-auto overscroll-contain bg-[#f7f8fa] ${
              composerOpen && composerExpanded
                ? "hidden"
                : "flex-1"
            }`}
          >
            <div className="mt-auto space-y-5 px-3 py-4 sm:px-4">
            {!selected ? null : loadingThread ? (
              <p className="text-sm text-slate-500">Loading thread…</p>
            ) : feedByDay.length === 0 ? (
              <p className="text-sm text-slate-500">
                No messages or activity yet.
              </p>
            ) : (
              feedByDay.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex justify-center py-1">
                    <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((item) => {
                    if (item.kind === "activity") {
                      const a = item.activity;
                      const icon = activityGlyph(a.type);
                      const body = (
                        <>
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-[10px] font-semibold text-slate-600">
                            {icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-slate-700">
                              {a.title}
                            </span>
                            {a.detail ? (
                              <span className="text-slate-500">
                                {" "}
                                · {a.detail}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                            {formatShortTime(a.at)}
                          </span>
                        </>
                      );
                      return (
                        <div key={a.id} className="flex justify-center px-2">
                          {a.href ? (
                            <a
                              href={a.href}
                              target={
                                a.href.startsWith("http") ? "_blank" : undefined
                              }
                              rel={
                                a.href.startsWith("http")
                                  ? "noreferrer"
                                  : undefined
                              }
                              className="flex w-full max-w-[min(84%,36rem)] items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-left text-xs text-slate-600 shadow-sm hover:border-sky-200 hover:bg-white"
                            >
                              {body}
                            </a>
                          ) : (
                            <div className="flex w-full max-w-[min(84%,36rem)] items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-xs text-slate-600 shadow-sm">
                              {body}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const m = item.message;
                    const open = expandedIds.has(m.id);
                    const outbound = m.direction === "outbound";
                    const isComment = m.channel === "system";
                    const isEmail = (m.channel || "").toLowerCase() === "email";
                    const attachments = messageAttachmentsOf(m);
                    const body =
                      (m.body_text || "").trim() ||
                      (attachments.length ? "" : "(empty)");
                    const subject = m.subject?.trim() || null;
                    const isSending = m.status === "sending";
                    const failed =
                      m.status === "failed" || Boolean(m.provider_error);
                    const uploading = isSending && attachments.length > 0;
                    // Emails (and notes) always collapse; SMS only if very long.
                    const collapsible =
                      isComment || isEmail || body.length > 280;
                    const showFull = open || !collapsible;

                    if (isComment) {
                      return (
                        <div key={m.id} className="flex justify-center px-4">
                          <div className="w-full max-w-[min(84%,36rem)] overflow-hidden rounded-xl border border-dashed border-amber-200 bg-amber-50/80 text-sm text-amber-950">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(m.id)}
                              aria-expanded={open}
                              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-amber-50"
                            >
                              <span className="text-[10px] text-amber-600/80">
                                {open ? "▾" : "▸"}
                              </span>
                              <ChannelIcon
                                channel="system"
                                className="text-amber-600"
                              />
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-amber-800">
                                Internal note
                                {!open ? (
                                  <span className="font-normal text-amber-700/70">
                                    {" · "}
                                    {previewText(body, 72)}
                                  </span>
                                ) : null}
                              </span>
                              <span className="shrink-0 text-[10px] tabular-nums text-amber-600/70">
                                {formatShortTime(m.created_at)}
                              </span>
                            </button>
                            {open ? (
                              <div className="border-t border-amber-200/60 px-3.5 py-2.5 whitespace-pre-wrap">
                                {body}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    }

                    // Emails: wider card with subject header + collapse.
                    // SMS/etc: chat bubble; collapse only when very long.
                    if (isEmail) {
                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 ${
                            outbound ? "justify-end" : "justify-start"
                          }`}
                        >
                          {!outbound ? (
                            <AvatarWithChannels
                              name={displayName}
                              url={prospectAvatarUrl}
                              size="md"
                              channels={replyChannels}
                            />
                          ) : null}
                          <div
                            className={`w-full max-w-[min(84%,36rem)] overflow-hidden rounded-2xl text-sm shadow-sm ring-1 ${
                              outbound
                                ? failed
                                  ? "rounded-br-md bg-sky-50 ring-amber-300/80"
                                  : "rounded-br-md bg-sky-100/90 ring-sky-200/70"
                                : failed
                                  ? "rounded-bl-md bg-white ring-amber-300/80"
                                  : "rounded-bl-md bg-white ring-slate-200/80"
                            }`}
                          >
                            <div
                              className={`flex w-full items-start gap-2 px-3.5 py-2.5 ${
                                outbound
                                  ? "hover:bg-sky-100"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleExpanded(m.id)}
                                aria-expanded={open}
                                className="mt-0.5 shrink-0 text-[10px] text-slate-400"
                              >
                                {open ? "▾" : "▸"}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleExpanded(m.id)}
                                aria-expanded={open}
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className="flex items-center gap-1.5">
                                  <ChannelIcon
                                    channel="email"
                                    className={
                                      outbound
                                        ? "text-sky-700/70"
                                        : "text-slate-400"
                                    }
                                  />
                                  <span
                                    className={`truncate text-sm font-semibold ${
                                      outbound
                                        ? "text-sky-950"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {subject || "Email"}
                                  </span>
                                  <span
                                    className={`ml-auto shrink-0 text-[10px] tabular-nums ${
                                      outbound
                                        ? "text-sky-800/55"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {isSending ? (
                                      <span className="inline-flex items-center gap-1 font-medium text-sky-700/70">
                                        <Loader2
                                          className="h-3 w-3 animate-spin"
                                          strokeWidth={2}
                                        />
                                        Sending…
                                      </span>
                                    ) : (
                                      formatShortTime(m.created_at)
                                    )}
                                  </span>
                                </span>
                                {!open ? (
                                  <span
                                    className={`mt-0.5 block truncate text-xs ${
                                      outbound
                                        ? "text-sky-900/55"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {previewText(body, 110)}
                                  </span>
                                ) : null}
                              </button>
                              {failed ? (
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <MessageErrorBadge
                                    message={
                                      m.provider_error || "Failed to send"
                                    }
                                    align="right"
                                  />
                                  {isOptimisticId(m.id) ? (
                                    <button
                                      type="button"
                                      onClick={() => dismissOptimistic(m.id)}
                                      className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline"
                                    >
                                      Dismiss
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            {open ? (
                              <div
                                className={`border-t px-3.5 py-3 ${
                                  outbound
                                    ? "border-sky-200/60"
                                    : "border-slate-100"
                                }`}
                              >
                                {(m.from_address || m.to_address) && (
                                  <div className="mb-2.5 space-y-0.5 text-[11px] text-slate-500">
                                    {m.from_address ? (
                                      <div>
                                        <span className="text-slate-400">
                                          From{" "}
                                        </span>
                                        {m.from_address}
                                      </div>
                                    ) : null}
                                    {m.to_address ? (
                                      <div>
                                        <span className="text-slate-400">
                                          To{" "}
                                        </span>
                                        {m.to_address}
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                                <div className="whitespace-pre-wrap leading-relaxed text-slate-800">
                                  {body}
                                </div>
                                <MessageAttachments
                                  attachments={attachments}
                                  tone={outbound ? "sky" : "neutral"}
                                  uploading={uploading}
                                />
                              </div>
                            ) : null}
                          </div>
                          {outbound ? (
                            <Avatar
                              name={coachProfile.name}
                              url={coachProfile.avatarUrl}
                              size="md"
                              tone="sky"
                            />
                          ) : null}
                        </div>
                      );
                    }

                    // SMS / WhatsApp-style bubble
                    return (
                      <div
                        key={m.id}
                        className={`flex items-end gap-2 ${
                          outbound ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!outbound ? (
                          <AvatarWithChannels
                            name={displayName}
                            url={prospectAvatarUrl}
                            size="md"
                            channels={replyChannels}
                          />
                        ) : null}
                        <div
                          className={`max-w-[min(70%,26rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ring-1 ${
                            outbound
                              ? failed
                                ? "rounded-br-md bg-sky-50 text-slate-900 ring-amber-300/80"
                                : isSending
                                  ? "rounded-br-md bg-sky-100/70 text-slate-900 ring-sky-200/50"
                                  : "rounded-br-md bg-sky-100/90 text-slate-900 ring-sky-200/70"
                              : failed
                                ? "rounded-bl-md bg-white text-slate-900 ring-amber-300/80"
                                : "rounded-bl-md bg-white text-slate-900 ring-slate-200/80"
                          }`}
                        >
                          {failed ? (
                            <div
                              className={`mb-1.5 flex items-center gap-2 ${
                                outbound ? "justify-end" : "justify-start"
                              }`}
                            >
                              <MessageErrorBadge
                                message={
                                  m.provider_error || "Failed to send"
                                }
                                align={outbound ? "right" : "left"}
                              />
                              {isOptimisticId(m.id) ? (
                                <button
                                  type="button"
                                  onClick={() => dismissOptimistic(m.id)}
                                  className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline"
                                >
                                  Dismiss
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsible) toggleExpanded(m.id);
                            }}
                            aria-expanded={collapsible ? open : undefined}
                            className={`w-full text-left ${
                              collapsible ? "" : "cursor-default"
                            }`}
                          >
                            {body ? (
                              <div className="whitespace-pre-wrap leading-relaxed">
                                {showFull ? body : previewText(body, 240)}
                              </div>
                            ) : null}
                            {(showFull || !body) && attachments.length ? (
                              <MessageAttachments
                                attachments={attachments}
                                tone={outbound ? "sky" : "neutral"}
                                uploading={uploading}
                              />
                            ) : null}
                            {collapsible && !open ? (
                              <div className="mt-1 text-[11px] font-medium text-sky-700">
                                Show more
                              </div>
                            ) : null}
                          </button>
                          <div
                            className={`mt-1.5 flex items-center gap-1.5 ${
                              outbound ? "justify-end" : "justify-start"
                            }`}
                          >
                            {outbound ? (
                              <ChannelIcon
                                channel={m.channel}
                                className="text-sky-700/60"
                              />
                            ) : null}
                            {isSending ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700/70">
                                <Loader2
                                  className="h-3 w-3 animate-spin"
                                  strokeWidth={2}
                                />
                                {uploading ? "Uploading…" : "Sending…"}
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] tabular-nums ${
                                  outbound
                                    ? "text-sky-800/55"
                                    : "text-slate-400"
                                }`}
                              >
                                {formatShortTime(m.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        {outbound ? (
                          <Avatar
                            name={coachProfile.name}
                            url={coachProfile.avatarUrl}
                            size="md"
                            tone="sky"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={threadBottomRef} aria-hidden className="h-px w-full shrink-0" />
          </div>
          </div>

          {/* Composer */}
          {selected ? (
            <div
              className={`relative flex flex-col border-t border-slate-200 bg-white ${
                composerOpen && composerExpanded
                  ? "min-h-0 flex-1"
                  : "shrink-0"
              }`}
            >
              {!composerOpen ? (
                <div className="px-3 py-2.5">
                  <div className="relative">
                    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        aria-label={`Message on ${channelLabelOf(replyChannel)}`}
                        aria-expanded={channelMenuOpen}
                        onClick={() => setChannelMenuOpen((v) => !v)}
                        className="flex shrink-0 items-center gap-1 border-r border-slate-200 px-2.5 py-2 hover:bg-slate-50"
                      >
                        <ChannelMark channel={replyChannel} />
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setComposerOpen(true);
                          setChannelMenuOpen(false);
                        }}
                        className="min-w-0 flex-1 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
                      >
                        Type a message
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setComposerOpen(true);
                          setChannelMenuOpen(false);
                        }}
                        className="flex shrink-0 items-center justify-center border-l border-slate-200 px-3 py-2 text-sky-600 hover:bg-sky-50"
                        aria-label="Compose"
                      >
                        <Send className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                    <ChannelPickerMenu
                      open={channelMenuOpen}
                      current={replyChannel}
                      options={composerChannelOptions(selected)}
                      onPick={(id) => {
                        setReplyChannel(id);
                        setChannelMenuOpen(false);
                        setComposerOpen(true);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className={`flex min-h-0 flex-col ${
                    composerExpanded ? "h-full flex-1" : ""
                  }`}
                >
                  <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                    <button
                      type="button"
                      aria-label={`Channel: ${channelLabelOf(replyChannel)}`}
                      aria-expanded={channelMenuOpen}
                      onClick={() => setChannelMenuOpen((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      <ChannelMark channel={replyChannel} size="md" />
                      <span>{channelLabelOf(replyChannel)}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Minimize"
                        onClick={() => {
                          setComposerOpen(false);
                          setComposerExpanded(false);
                          setChannelMenuOpen(false);
                        }}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      >
                        <Minus className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        title={composerExpanded ? "Shrink composer" : "Expand composer"}
                        onClick={() => setComposerExpanded((v) => !v)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      >
                        {composerExpanded ? (
                          <Minimize2 className="h-4 w-4" strokeWidth={1.75} />
                        ) : (
                          <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
                        )}
                      </button>
                    </div>
                    <ChannelPickerMenu
                      open={channelMenuOpen}
                      current={replyChannel}
                      options={composerChannelOptions(selected)}
                      onPick={(id) => {
                        setReplyChannel(id);
                        setChannelMenuOpen(false);
                      }}
                    />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                    {replyChannel === "email" ? (
                      <div className="shrink-0 space-y-2 text-sm">
                        <label className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-xs text-slate-500">
                            From name
                          </span>
                          <input
                            value={fromName}
                            onChange={(e) => setFromName(e.target.value)}
                            placeholder="Coach name"
                            className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
                          />
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-xs text-slate-500">
                            To
                          </span>
                          <span className="truncate text-sm text-slate-700">
                            {selected.prospect_email || "—"}
                          </span>
                        </div>
                        <label className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-xs text-slate-500">
                            Subject
                          </span>
                          <input
                            value={replySubject}
                            onChange={(e) => setReplySubject(e.target.value)}
                            className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
                          />
                        </label>
                      </div>
                    ) : null}

                    {replyChannel === "sms" ? (
                      <div className="shrink-0 text-xs text-slate-500">
                        To {selected.prospect_phone}
                      </div>
                    ) : null}

                    {replyChannel === "comment" ? (
                      <div className="shrink-0 text-xs text-amber-700">
                        Internal only — not sent to the contact.
                      </div>
                    ) : null}

                    <div
                      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-sky-400 ${
                        composerExpanded ? "flex-1" : ""
                      }`}
                    >
                      <textarea
                        ref={replyTextareaRef}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        rows={
                          composerExpanded
                            ? undefined
                            : replyChannel === "email"
                              ? 8
                              : 4
                        }
                        autoFocus
                        placeholder={
                          replyChannel === "comment"
                            ? "Add an internal note…"
                            : mediaComposerEnabled
                              ? "Write a message..."
                              : "Type a message"
                        }
                        className={`min-h-[5.5rem] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm outline-none ${
                          composerExpanded ? "min-h-0 flex-1" : ""
                        }`}
                      />
                    </div>

                    {sendError ? (
                      <p className="shrink-0 text-xs text-red-600">{sendError}</p>
                    ) : null}
                    {scheduleNotice ? (
                      <p className="shrink-0 text-xs text-emerald-700">
                        {scheduleNotice}
                      </p>
                    ) : null}

                    <div className="shrink-0">
                      <ChatComposerTools
                        enabled={mediaComposerEnabled}
                        pendingFiles={pendingFiles}
                        pendingVoice={pendingVoice}
                        pendingVideo={pendingVideo}
                        onAddFiles={(list) => addPendingFiles(list)}
                        onRemoveFile={(id) => {
                          setPendingFiles((prev) => {
                            const victim = prev.find((p) => p.id === id);
                            if (victim?.previewUrl)
                              URL.revokeObjectURL(victim.previewUrl);
                            return prev.filter((p) => p.id !== id);
                          });
                        }}
                        onVoiceChange={(note) => {
                          setPendingVoice((prev) => {
                            if (prev?.url && prev.url !== note?.url) {
                              URL.revokeObjectURL(prev.url);
                            }
                            return note;
                          });
                        }}
                        onVideoChange={(note) => {
                          setPendingVideo((prev) => {
                            if (prev?.url && prev.url !== note?.url) {
                              URL.revokeObjectURL(prev.url);
                            }
                            return note;
                          });
                        }}
                        onInsertEmoji={insertEmojiAtCursor}
                        onDiscard={() => {
                          clearPendingFiles();
                          setReplyBody("");
                          setComposerOpen(false);
                          setComposerExpanded(false);
                          setSendError(null);
                        }}
                        onSend={() => void sendReply()}
                        onOpenSchedule={() => setScheduleOpen(true)}
                        sending={scheduleSending}
                        canSend={Boolean(
                          replyBody.trim() ||
                            pendingFiles.length ||
                            pendingVoice ||
                            pendingVideo
                        )}
                        showSchedule={mediaComposerEnabled}
                      />
                    </div>
                  </div>
                  <ScheduleMessageModal
                    open={scheduleOpen}
                    onClose={() => setScheduleOpen(false)}
                    busy={scheduleSending}
                    onSchedule={(iso) => void sendReply({ scheduledFor: iso })}
                  />
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* Right: contact / prospect details */}
        <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden border-t border-slate-200 bg-white xl:flex xl:border-l xl:border-t-0">
          <div className="shrink-0 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Details</h2>
          </div>

          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
              Select a conversation to see contact details.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="flex items-start gap-3 px-4 pb-4 pt-4">
                <Avatar
                  name={displayName}
                  url={prospectAvatarUrl}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-slate-900">
                      {displayName}
                    </h3>
                    {linkedIn ? (
                      <a
                        href={linkedIn}
                        target="_blank"
                        rel="noreferrer"
                        title="LinkedIn profile"
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        <LinkedInSolidIcon className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  {prospectDetails?.job_title?.trim() ? (
                    <p className="truncate text-sm text-slate-600">
                      {prospectDetails.job_title.trim()}
                    </p>
                  ) : null}
                  <BusinessNameField
                    value={businessDraft}
                    onChange={setBusinessDraft}
                    onSave={() => void saveBusinessName()}
                  />
                  {prospectHref ? (
                    <a
                      href={prospectHref}
                      className="mt-2 inline-block text-xs font-medium text-sky-700 hover:text-sky-800"
                    >
                      View prospect →
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5 border-t border-slate-100 px-4 py-4">
                <CollapsibleDetailSection
                  title="Assessment"
                  open={detailSectionsOpen.assessment}
                  onToggle={() => toggleDetailSection("assessment")}
                >
                  <dl className="space-y-2.5">
                    <DetailRow label="Boss Score">
                      {prospectDetails?.boss_score != null ? (
                        <>
                          {`${Math.round(prospectDetails.boss_score)}%`}
                          {prospectDetails.boss_score_at ? (
                            <span className="text-slate-500">
                              {" "}
                              · {formatShortDate(prospectDetails.boss_score_at)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <DetailEmpty />
                      )}
                    </DetailRow>
                    <DetailRow label="Boss Pro">
                      {prospectDetails?.boss_score_premium != null ? (
                        <>
                          {Math.round(prospectDetails.boss_score_premium)}
                          {prospectDetails.boss_score_premium_at ? (
                            <span className="text-slate-500">
                              {" "}
                              ·{" "}
                              {formatShortDate(
                                prospectDetails.boss_score_premium_at
                              )}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <DetailEmpty />
                      )}
                    </DetailRow>
                    <DetailRow label="Revenue">
                      {prospectDetails?.revenue?.trim() || <DetailEmpty />}
                    </DetailRow>
                    <DetailRow label="Team size">
                      {prospectDetails?.team_size?.trim() || <DetailEmpty />}
                    </DetailRow>
                  </dl>
                </CollapsibleDetailSection>

                {bookingDetails ? (
                  <CollapsibleDetailSection
                    title="Booking"
                    open={detailSectionsOpen.booking}
                    onToggle={() => toggleDetailSection("booking")}
                  >
                    <dl className="space-y-2.5">
                      <DetailRow label="When">
                        {formatShortDateTime(bookingDetails.starts_at)}
                      </DetailRow>
                      {bookingDetails.status ? (
                        <DetailRow label="Status">
                          <span className="capitalize">
                            {bookingDetails.status.replace(/_/g, " ")}
                          </span>
                        </DetailRow>
                      ) : null}
                      {bookingDetails.meeting_join_url ? (
                        <DetailRow label="Meeting">
                          <a
                            href={bookingDetails.meeting_join_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-sky-700"
                          >
                            Join link
                          </a>
                        </DetailRow>
                      ) : null}
                    </dl>
                  </CollapsibleDetailSection>
                ) : null}

                <CollapsibleDetailSection
                  title="Conversation"
                  open={detailSectionsOpen.conversation}
                  onToggle={() => toggleDetailSection("conversation")}
                >
                  <dl className="space-y-2.5">
                    <DetailRow label="Last activity">
                      {formatShortDateTime(selected.last_message_at)}
                    </DetailRow>
                    <DetailRow label="Messages">{messages.length}</DetailRow>
                    {email ? (
                      <DetailRow label="Email">
                        <a
                          href={`mailto:${email}`}
                          className="hover:text-sky-700"
                        >
                          {email}
                        </a>
                      </DetailRow>
                    ) : null}
                    {phone ? (
                      <DetailRow label="Phone">
                        <a href={`tel:${phone}`} className="hover:text-sky-700">
                          {phone}
                        </a>
                      </DetailRow>
                    ) : null}
                  </dl>
                </CollapsibleDetailSection>

                <CollapsibleDetailSection
                  title="Notes"
                  open={detailSectionsOpen.notes}
                  onToggle={() => toggleDetailSection("notes")}
                  badge={
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">
                      {noteCount}
                    </span>
                  }
                >
                  <div className="space-y-2.5">
                    {noteMessages.length === 0 ? (
                      <p className="text-sm text-slate-500">No notes yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {noteMessages.map((n) => (
                          <li
                            key={n.id}
                            className="rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2 text-xs leading-snug text-amber-950"
                          >
                            <p className="whitespace-pre-wrap">
                              {(n.body_text || "").trim() || "(empty)"}
                            </p>
                            <p className="mt-1 text-[10px] tabular-nums text-amber-700/70">
                              {formatShortDateTime(n.created_at)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyChannel("comment");
                        setComposerOpen(true);
                        setChannelMenuOpen(false);
                      }}
                      className="text-xs font-medium text-sky-700 hover:text-sky-800"
                    >
                      Add note
                    </button>
                  </div>
                </CollapsibleDetailSection>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile details (below thread when the right sidebar is hidden) */}
        {selected ? (
          <div className="col-span-full border-t border-slate-200 bg-white px-4 py-5 lg:hidden">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Details</h2>
            <div className="flex items-start gap-3">
              <Avatar
                name={displayName}
                url={prospectAvatarUrl}
                size="md"
              />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 font-semibold text-slate-900">
                    {displayName}
                  </div>
                  {linkedIn ? (
                    <a
                      href={linkedIn}
                      target="_blank"
                      rel="noreferrer"
                      title="LinkedIn profile"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200"
                    >
                      <LinkedInSolidIcon className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
                {prospectDetails?.job_title?.trim() ? (
                  <div className="text-slate-600">
                    {prospectDetails.job_title.trim()}
                  </div>
                ) : null}
                <BusinessNameField
                  value={businessDraft}
                  onChange={setBusinessDraft}
                  onSave={() => void saveBusinessName()}
                />
                <div className="text-xs text-slate-400">
                  Last activity {formatShortDateTime(selected.last_message_at)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
