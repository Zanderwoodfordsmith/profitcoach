"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  Bell,
  Check,
  CircleDashed,
  Clock,
  MessageCircle,
} from "lucide-react";
import {
  leadStatusIcon,
  leadStatusLabel,
  leadStatusTone,
  type LeadStatusIcon,
  type LeadStatusTone,
} from "@/lib/unipile/campaignLeadActivity";

const TONE_CLASS: Record<LeadStatusTone, string> = {
  emerald: "bg-emerald-50 text-emerald-800",
  sky: "bg-sky-50 text-sky-800",
  amber: "bg-amber-50 text-amber-900",
  rose: "bg-rose-50 text-rose-800",
  slate: "bg-slate-100 text-slate-600",
};

function StatusGlyph({ kind }: { kind: LeadStatusIcon }) {
  const cls = "h-3 w-3 shrink-0";
  switch (kind) {
    case "replied":
      return <MessageCircle className={cls} aria-hidden />;
    case "connected":
    case "finished":
      return <Check className={cls} aria-hidden />;
    case "pending":
      return <Clock className={cls} aria-hidden />;
    case "needsYou":
      return <Bell className={cls} aria-hidden />;
    case "failed":
      return <AlertCircle className={cls} aria-hidden />;
    default:
      return <CircleDashed className={cls} aria-hidden />;
  }
}

export function shortStepLabel(type: string) {
  switch (type) {
    case "invite":
      return "Invite";
    case "message":
      return "Message";
    case "email":
      return "Email";
    case "call":
      return "Call";
    case "whatsapp":
      return "WhatsApp";
    case "comment":
      return "Comment";
    case "react":
      return "Like";
    case "visit":
      return "View";
    default:
      return type;
  }
}

export const ACTIVITY_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)_5.25rem] gap-2";

export function PaneStatusChip({
  tone,
  icon,
  label,
}: {
  tone: LeadStatusTone;
  icon: LeadStatusIcon;
  label: string;
}) {
  return (
    <span
      title={label}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      <StatusGlyph kind={icon} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function leadChip(status: string | null) {
  const value = status || "queued";
  return {
    tone: leadStatusTone(value),
    icon: leadStatusIcon(value),
    label: leadStatusLabel(value),
  };
}

export function ActivityTableHeader() {
  return (
    <div
      className={`${ACTIVITY_ROW_GRID} shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500`}
    >
      <div>Lead</div>
      <div>Status</div>
      <div>Next step</div>
    </div>
  );
}

export function ActivityTableRow({
  name,
  status,
  next,
  open,
  onToggle,
  children,
}: {
  name: string;
  status: { tone: LeadStatusTone; icon: LeadStatusIcon; label: string };
  next: string;
  open?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}) {
  const main = (
    <>
      <span className="min-w-0 truncate text-sm font-medium text-slate-900" title={name}>
        {name}
      </span>
      <span className="min-w-0">
        <PaneStatusChip {...status} />
      </span>
      <span className="truncate text-sm font-medium text-slate-800" title={next}>
        {next}
      </span>
    </>
  );

  return (
    <li className="border-b border-slate-100 last:border-b-0">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`${ACTIVITY_ROW_GRID} w-full items-center px-3 py-3 text-left hover:bg-slate-50/80`}
        >
          {main}
        </button>
      ) : (
        <div className={`${ACTIVITY_ROW_GRID} items-center px-3 py-3`}>{main}</div>
      )}
      {open && children ? (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-3">
          {children}
        </div>
      ) : null}
    </li>
  );
}
