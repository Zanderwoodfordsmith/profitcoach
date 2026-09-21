"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronDown,
  CircleAlert,
  Clock,
  Copy,
  Eye,
  FolderInput,
  GripVertical,
  Heart,
  Info,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  Phone,
  PhoneCall,
  Plus,
  LayoutTemplate,
  Trash2,
  User,
  UserPlus,
  UserRoundPlus,
  Video,
  X,
} from "lucide-react";
import {
  addToCampaignIdFrom,
  campaignSendModePatch,
  campaignStepAllowsVariants,
  campaignStepDisplayLabel,
  keepAbPair,
  campaignStepHasCopy,
  campaignStepHasSendMode,
  campaignStepIncompleteHint,
  campaignStepSendMode,
  sequenceMessageSendMode,
  callWaitFrom,
  inviteNoConnectFrom,
  isCampaignStepType,
  messageMediaFrom,
  messageMediaKindFrom,
  notifyChannelSummary,
  notifyConfigFrom,
  type CampaignStepMedia,
  type CampaignStepMediaKind,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
import { moveSequenceItem } from "@/lib/unipile/campaignStepReorder";
import {
  WAIT_UNITS,
  WAIT_UNIT_MAX,
  formatWaitDuration,
  inferWaitDuration,
  waitToHours,
  type WaitUnit,
} from "@/lib/unipile/waitDuration";
import {
  abMetricForStep,
  abRatePercent,
  abWinningKey,
  type AbVariantStats,
} from "@/lib/unipile/abMetrics";
import {
  isMergeFieldDrag,
  MergeFieldComposer,
  MergeFieldPreview,
} from "@/components/campaigns/MergeFieldComposer";
import {
  ContentWithRail,
  ContentWithRailAside,
  ContentWithRailMain,
} from "@/components/layout";
import {
  isMailingProvider,
  normalizeUnipileProvider,
  type UnipileConnectProvider,
} from "@/lib/unipile/providers";
import {
  InviteNoConnectBranch,
  MessageStepMedia,
} from "@/components/campaigns/CampaignStepExtras";
import { startDragAutoScroll } from "@/lib/campaigns/dragAutoScroll";
import type { InviteFunnelSlice } from "@/lib/unipile/campaignLeadActivity";

export type SequenceAccount = {
  id: string;
  status: string;
  display_name: string | null;
  provider?: string;
};

export type SequenceStep = {
  id?: string;
  position: number;
  step_type: CampaignStepType;
  body: string | null;
  wait_hours: number | null;
  variants?: Array<{
    key: string;
    label?: string;
    body: string;
    media_kind?: CampaignStepMediaKind | null;
    media?: CampaignStepMedia | null;
  }> | null;
  send_mode?: "auto" | "remind" | null;
  fallback_hours?: number | null;
  fallback_body?: string | null;
  config?: Record<string, unknown> | null;
};

export type SequenceCampaignOption = {
  id: string;
  name: string;
};

export type { InviteFunnelSlice };

export type StepPeopleCounts = {
  here: number;
  wait?: {
    names: string[];
    nextLabel: string | null;
  };
  invite?: {
    connected: number;
    waiting: number;
    remaining: number;
    total: number;
    names: Record<InviteFunnelSlice, string[]>;
  };
};

export const EMPTY_STEP_PEOPLE: StepPeopleCounts = { here: 0 };

export type LeadDrawerPayload =
  | { kind: "step"; position: number; title: string }
  | { kind: "wait"; position: number; title: string }
  | {
      kind: "invite";
      slice: InviteFunnelSlice;
      position: number;
      title: string;
    }
  | { kind: "hopper"; hopper: "staging" | "active"; title: string };

const STEP_DRAG_PREFIX = "pc-step:";
const STEP_MOVE_PREFIX = "pc-move:";

function paletteDragValue(
  type: CampaignStepType,
  mediaKind?: CampaignStepMediaKind
) {
  return mediaKind
    ? `${STEP_DRAG_PREFIX}${type}:${mediaKind}`
    : `${STEP_DRAG_PREFIX}${type}`;
}

function parseDragType(event: React.DragEvent): {
  type: CampaignStepType;
  mediaKind?: CampaignStepMediaKind;
} | null {
  const raw =
    event.dataTransfer.getData("text/plain") ||
    event.dataTransfer.getData("text");
  if (!raw.startsWith(STEP_DRAG_PREFIX)) return null;
  const rest = raw.slice(STEP_DRAG_PREFIX.length);
  const [type, mediaKind] = rest.split(":");
  if (!type || !isCampaignStepType(type)) return null;
  return {
    type: type as CampaignStepType,
    mediaKind:
      mediaKind === "voice" || mediaKind === "video" ? mediaKind : undefined,
  };
}

function parseMoveIndex(event: React.DragEvent): number | null {
  const raw =
    event.dataTransfer.getData("text/plain") ||
    event.dataTransfer.getData("text");
  if (!raw.startsWith(STEP_MOVE_PREFIX)) return null;
  const index = Number(raw.slice(STEP_MOVE_PREFIX.length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

type PaletteItem = {
  type?: CampaignStepType;
  mediaKind?: CampaignStepMediaKind;
  label: string;
  hint?: string;
  info?: string;
  icon: LucideIcon;
  enabled: boolean;
  connectProvider?: UnipileConnectProvider;
  soon?: boolean;
};

type PaletteGroupId = "flow" | "linkedin" | "channels" | "instagram";

type PaletteGroup = {
  id: PaletteGroupId;
  title: string;
  items: PaletteItem[];
};

function PaletteItemRow({
  item,
  connectingProvider,
  onAdd,
  onConnect,
  onDragStart,
  onDragEnd,
  variant = "rail",
}: {
  item: PaletteItem;
  connectingProvider: string | null;
  onAdd: (type: CampaignStepType, mediaKind?: CampaignStepMediaKind) => void;
  onConnect: (provider: UnipileConnectProvider) => void;
  onDragStart: (type: CampaignStepType) => void;
  onDragEnd: () => void;
  variant?: "rail" | "menu";
}) {
  const Icon = item.icon;
  const rowClass =
    variant === "menu"
      ? "flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
      : "flex w-full cursor-grab items-start gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-white active:cursor-grabbing";
  if (item.enabled && item.type) {
    return (
      <li>
        <button
          type="button"
          draggable={variant === "rail"}
          onDragStart={
            variant === "rail"
              ? (event) => {
                  event.dataTransfer.setData(
                    "text/plain",
                    paletteDragValue(item.type!, item.mediaKind)
                  );
                  event.dataTransfer.effectAllowed = "copy";
                  onDragStart(item.type!);
                }
              : undefined
          }
          onDragEnd={variant === "rail" ? onDragEnd : undefined}
          onClick={() => onAdd(item.type!, item.mediaKind)}
          className={rowClass}
        >
          <Icon
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800">
              {item.label}
            </span>
            {item.hint ? (
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                {item.hint}
              </span>
            ) : null}
          </span>
        </button>
      </li>
    );
  }
  return (
    <li>
      <div className="flex items-start gap-2.5 rounded-lg px-1.5 py-2">
        <Icon
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-300"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <span className="block text-sm font-medium text-slate-400">
              {item.label}
            </span>
            {item.info ? (
              <span className="group/info relative inline-flex shrink-0">
                <button
                  type="button"
                  aria-label={`What ${item.label} can do`}
                  className="rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus-visible:text-slate-600 focus-visible:outline-none"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 hidden w-max max-w-[14rem] rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-white shadow-sm group-hover/info:block group-focus-within/info:block"
                >
                  {item.info}
                </span>
              </span>
            ) : null}
          </span>
          {item.soon ? (
            <span className="mt-0.5 block text-[11px] text-slate-400">
              Coming soon
            </span>
          ) : null}
        </span>
        {item.connectProvider ? (
          <button
            type="button"
            disabled={connectingProvider === item.connectProvider}
            onClick={() => onConnect(item.connectProvider!)}
            className="shrink-0 pt-0.5 text-[11px] font-semibold text-[#0c5290] hover:underline disabled:opacity-50"
          >
            {connectingProvider === item.connectProvider
              ? "Connecting…"
              : "Connect"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

const STEP_ICONS: Record<CampaignStepType, LucideIcon> = {
  invite: UserPlus,
  message: MessageSquare,
  wait: Clock,
  comment: MessageCircle,
  react: Heart,
  visit: Eye,
  follow: UserRoundPlus,
  email: Mail,
  whatsapp: Phone,
  instagram: MessageSquare,
  instagram_react: Heart,
  instagram_comment: MessageCircle,
  instagram_follow: UserRoundPlus,
  messenger: MessageCircle,
  notify: Bell,
  add_to_campaign: FolderInput,
  call: PhoneCall,
};

function messageCopyPlaceholder(
  config: Record<string, unknown> | null | undefined,
  mediaKind?: CampaignStepMediaKind | null
) {
  const kind = mediaKind ?? messageMediaKindFrom(config);
  if (kind === "video") return "Optional note with the video";
  if (kind === "voice") return "Optional note with the voice note";
  return undefined;
}

function stepIcon(step: SequenceStep): LucideIcon {
  if (step.step_type === "message") {
    const kind = messageMediaKindFrom(step.config);
    if (kind === "voice") return Mic;
    if (kind === "video") return Video;
  }
  return STEP_ICONS[step.step_type];
}

function accountOk(
  accounts: SequenceAccount[],
  match: (provider: string) => boolean
) {
  return accounts.some(
    (a) => a.status === "OK" && match(normalizeUnipileProvider(a.provider))
  );
}

function stepPreview(
  step: SequenceStep,
  campaigns: SequenceCampaignOption[]
): string {
  if (step.step_type === "react" || step.step_type === "instagram_react") {
    return step.step_type === "instagram_react"
      ? "Likes their most recent Instagram post"
      : "Likes their most recent post";
  }
  if (step.step_type === "instagram_follow") return "Follows them on Instagram";
  if (step.step_type === "visit") return "Views their profile (they can see it)";
  if (step.step_type === "notify") return notifyChannelSummary(step.config);
  if (step.step_type === "add_to_campaign") {
    const targetId = addToCampaignIdFrom(step.config);
    const name = campaigns.find((c) => c.id === targetId)?.name;
    return name || "Choose a campaign";
  }
  if (step.step_type === "invite") {
    const branch = inviteNoConnectFrom(step.config);
    if (branch.on_no_connect === "other_campaign") {
      const name = campaigns.find((c) => c.id === branch.no_connect_campaign_id)
        ?.name;
      return name
        ? `If they don't connect → ${name}`
        : "If they don't connect → pick a campaign";
    }
  }
  if (step.step_type === "message") {
    return (step.variants?.[0]?.body ?? step.body ?? "").trim();
  }
  if (step.step_type === "call") {
    const notes = (step.body ?? "").trim();
    if (callWaitFrom(step.config)) {
      return notes || "Sequence waits until you call";
    }
    return notes || "Call them. Sequence carries on.";
  }
  const first = step.variants?.[0]?.body ?? step.body ?? "";
  return first.trim() || "No copy yet";
}

function StepDiscloseButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
    >
      {open ? "Done" : "Edit"}
      <ChevronDown
        className={`h-3.5 w-3.5 text-slate-400 transition ${
          open ? "rotate-180" : ""
        }`}
        aria-hidden
      />
    </button>
  );
}

const INVITE_FUNNEL_SEGMENTS: Array<{
  slice: InviteFunnelSlice;
  phrase: string;
  className: string;
}> = [
  {
    slice: "connected",
    phrase: "connected",
    className: "bg-emerald-500 hover:bg-emerald-400",
  },
  {
    slice: "waiting",
    phrase: "waiting for accept",
    className: "bg-amber-400 hover:bg-amber-300",
  },
  {
    slice: "remaining",
    phrase: "not sent yet",
    className: "bg-slate-300 hover:bg-slate-400",
  },
];

function funnelNameLine(count: number, names: string[]): string | null {
  if (count <= 0 || names.length === 0) return null;
  const shown = names.slice(0, 4);
  const extra = count - shown.length;
  if (extra > 0) return `${shown.join(", ")} +${extra} more`;
  return shown.join(", ");
}

function InviteFunnelBar({
  invite,
  roundBottom,
  onOpenSlice,
}: {
  invite: NonNullable<StepPeopleCounts["invite"]>;
  roundBottom: boolean;
  onOpenSlice: (slice: InviteFunnelSlice, title: string) => void;
}) {
  if (invite.total <= 0) return null;
  return (
    <div
      className={`flex h-2 w-full ${roundBottom ? "rounded-b-xl" : ""}`}
      role="img"
      aria-label={`${invite.connected} connected, ${invite.waiting} waiting, ${invite.remaining} not sent yet`}
    >
      {INVITE_FUNNEL_SEGMENTS.map((segment) => {
        const count = invite[segment.slice];
        if (count <= 0) return null;
        const names = funnelNameLine(count, invite.names[segment.slice]);
        const title = `${count} ${segment.phrase}`;
        return (
          <button
            key={segment.slice}
            type="button"
            style={{ flex: count }}
            aria-label={title}
            onClick={() => onOpenSlice(segment.slice, title)}
            className={`group/seg relative min-w-[8px] ${segment.className} ${
              roundBottom ? "first:rounded-bl-xl last:rounded-br-xl" : ""
            } focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/50`}
          >
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-white shadow-sm group-hover/seg:block"
            >
              <span className="block">{title}</span>
              {names ? (
                <span className="mt-0.5 block font-normal text-white/80">
                  {names}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type SequenceVariant = NonNullable<SequenceStep["variants"]>[number];

function AbTestToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">A/B</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="A/B testing"
        onClick={() => onChange(!on)}
        className={`relative h-6 w-12 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          on
            ? "bg-emerald-700 focus-visible:ring-emerald-700/40"
            : "bg-rose-800 focus-visible:ring-rose-800/40"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-wide text-white ${
            on ? "left-[6px]" : "right-[6px]"
          }`}
          aria-hidden
        >
          {on ? "On" : "Off"}
        </span>
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            on ? "translate-x-6" : ""
          }`}
        />
      </button>
    </div>
  );
}

function SendModeToggle({
  mode,
  onChange,
  ariaLabel = "Send mode",
}: {
  mode: "auto" | "remind" | null;
  onChange: (mode: "auto" | "remind") => void;
  ariaLabel?: string;
}) {
  const options = [
    { value: "remind" as const, label: "Manual" },
    { value: "auto" as const, label: "Auto" },
  ];

  return (
    <div
      className="inline-grid shrink-0 grid-cols-2 rounded-full bg-slate-100 p-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={
              option.value === "remind"
                ? "You send this yourself"
                : "Sends on its own"
            }
            onClick={() => {
              if (!selected) onChange(option.value);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold leading-tight transition duration-150 focus-visible:outline-none focus-visible:ring-2 ${
              selected
                ? option.value === "auto"
                  ? "bg-[#0c5290] text-white focus-visible:ring-[#0c5290]/50"
                  : "bg-teal-600 text-white focus-visible:ring-teal-500/50"
                : "text-slate-400 hover:text-slate-600 focus-visible:ring-slate-400/50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function CallWaitOption({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2 text-left ${
        selected
          ? "border-[#0c5290] bg-sky-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span
        className={`block text-xs font-semibold ${
          selected ? "text-[#0c5290]" : "text-slate-800"
        }`}
      >
        {title}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
        {hint}
      </span>
    </button>
  );
}

function DropGap({
  insertAt,
  dragging,
  dropAt,
  dropEffect,
  onDragOverGap,
  onDropGap,
  showAdd,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  groups,
  connectingProvider,
  onAdd,
  onConnect,
}: {
  insertAt: number;
  dragging: boolean;
  dropAt: number | null;
  dropEffect: "copy" | "move";
  onDragOverGap: () => void;
  onDropGap: (event: React.DragEvent) => void;
  showAdd: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  groups: PaletteGroup[];
  connectingProvider: string | null;
  onAdd: (type: CampaignStepType, mediaKind?: CampaignStepMediaKind) => void;
  onConnect: (provider: UnipileConnectProvider) => void;
}) {
  const hot = dragging && dropAt === insertAt;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const plusVisible = showAdd && !dragging;

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onCloseMenu();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseMenu();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, onCloseMenu]);

  return (
    <div
      ref={rootRef}
      className={`relative flex flex-col items-center ${
        menuOpen && plusVisible ? "z-20" : ""
      }`}
      onDragOver={(event) => {
        if (isMergeFieldDrag()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = dropEffect;
        onDragOverGap();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropGap(event);
      }}
    >
      <div
        className={`flex w-full items-center justify-center px-8 transition-[height] duration-150 ${
          hot ? "h-10" : dragging ? "h-6" : plusVisible ? "py-4" : "h-3"
        }`}
      >
        {plusVisible ? (
          <>
            <span className="h-px min-w-4 flex-1 bg-slate-200" aria-hidden />
            <button
              type="button"
              aria-label="Add a step here"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={onToggleMenu}
              className="mx-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-[#0c5290] transition duration-150 hover:bg-sky-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
            >
              <Plus
                className={`h-3.5 w-3.5 transition ${menuOpen ? "rotate-45" : ""}`}
                strokeWidth={1.75}
                aria-hidden
              />
              Add step
            </button>
            <span className="h-px min-w-4 flex-1 bg-slate-200" aria-hidden />
          </>
        ) : (
          <span
            className={`absolute inset-x-10 h-px transition ${
              hot
                ? "bg-[#0c5290]"
                : dragging
                  ? "bg-slate-200"
                  : "bg-transparent"
            }`}
            aria-hidden
          />
        )}
      </div>
      {menuOpen && plusVisible ? (
        <div
          id={menuId}
          className="absolute top-full z-30 mb-2 w-[min(100%,18rem)] -translate-y-1 rounded-xl border border-slate-200 bg-white py-2 shadow-lg"
        >
          <div className="max-h-72 overflow-y-auto">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {group.title}
                </p>
                <ul>
                  {group.items.map((item) => (
                    <PaletteItemRow
                      key={item.label}
                      item={item}
                      variant="menu"
                      connectingProvider={connectingProvider}
                      onAdd={(type, mediaKind) => onAdd(type, mediaKind)}
                      onConnect={onConnect}
                      onDragStart={() => {}}
                      onDragEnd={() => {}}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WaitUnitToggle({
  unit,
  onChange,
  units = WAIT_UNITS,
  ariaLabel = "Wait unit",
}: {
  unit: WaitUnit;
  onChange: (unit: WaitUnit) => void;
  units?: readonly WaitUnit[];
  ariaLabel?: string;
}) {
  return (
    <div
      className="inline-flex rounded-full bg-white p-0.5 ring-1 ring-slate-200"
      role="group"
      aria-label={ariaLabel}
    >
      {units.map((option) => {
        const selected = unit === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (!selected) onChange(option);
            }}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 ${
              selected
                ? "bg-[#0c5290] text-white"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

const SEND_AFTER_UNITS = ["hours", "days", "weeks"] as const;

function sendAfterDuration(hours: number | null | undefined): {
  amount: number;
  unit: WaitUnit;
} {
  const inferred = inferWaitDuration(hours ?? 24);
  if (inferred.unit === "minutes") {
    return { amount: Math.max(1, inferred.amount), unit: "hours" };
  }
  return inferred;
}

function ManualSendAfter({
  hours,
  onChange,
  onCommit,
}: {
  hours: number | null | undefined;
  onChange: (hours: number) => void;
  onCommit: () => void;
}) {
  const { amount, unit } = sendAfterDuration(hours);

  function setDuration(nextAmount: number, nextUnit: WaitUnit) {
    const clamped = Math.min(
      WAIT_UNIT_MAX[nextUnit],
      Math.max(1, nextAmount)
    );
    onChange(waitToHours(clamped, nextUnit));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">If not sent, send after</span>
      <input
        type="number"
        min={1}
        max={WAIT_UNIT_MAX[unit]}
        aria-label="Send after amount"
        value={amount}
        onChange={(e) =>
          setDuration(Number(e.target.value || 1), unit)
        }
        onBlur={onCommit}
        className="w-12 rounded-full bg-white px-2 py-1 text-center text-sm font-semibold tabular-nums text-[#0c5290] outline-none ring-1 ring-[#0c5290]/20 focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
      />
      <WaitUnitToggle
        unit={unit}
        units={SEND_AFTER_UNITS}
        ariaLabel="Send after unit"
        onChange={(nextUnit) => {
          setDuration(amount, nextUnit);
          onCommit();
        }}
      />
      <span className="group/info relative inline-flex">
        <button
          type="button"
          aria-label="About sending if you don't"
          className="rounded-full p-0.5 text-slate-400 hover:text-[#0c5290] focus-visible:text-[#0c5290] focus-visible:outline-none"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-white shadow-sm group-hover/info:block group-focus-within/info:block"
        >
          You send this yourself. If you haven&apos;t sent it by then, it goes
          out automatically.
        </span>
      </span>
    </div>
  );
}

function QueueRow({
  count,
  names,
  onOpenLeads,
}: {
  count: number;
  names: string[];
  onOpenLeads: () => void;
}) {
  const empty = count <= 0;
  const nameLine = funnelNameLine(count, names);
  const label = empty
    ? "None set to send"
    : count === 1
      ? "1 set to send"
      : `${count} set to send`;
  return (
    <div className="flex items-center gap-2 px-2">
      <span className="h-px min-w-4 flex-1 bg-slate-200" aria-hidden />
      <button
        type="button"
        onClick={onOpenLeads}
        aria-label={
          empty
            ? "Nobody is set to receive a connection request yet"
            : `${label}. Open the queue.`
        }
        className="group/queue relative inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[#0c5290] shadow-sm hover:border-[#0c5290] hover:bg-sky-50"
      >
        <UserRoundPlus className="h-4 w-4" aria-hidden />
        {label}
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-white shadow-sm group-hover/queue:block"
        >
          <span className="block">
            {empty
              ? "Add prospects and they wait here until a connection request goes out"
              : "Waiting for a connection request"}
          </span>
          {nameLine ? (
            <span className="mt-0.5 block font-normal text-white/80">
              {nameLine}
            </span>
          ) : null}
        </span>
      </button>
      <span className="h-px min-w-4 flex-[0.8] bg-slate-200" aria-hidden />
    </div>
  );
}

function WaitPeopleChip({
  count,
  names,
  nextLabel,
  onOpenLeads,
}: {
  count: number;
  names: string[];
  nextLabel: string | null;
  onOpenLeads: () => void;
}) {
  const empty = count <= 0;
  const nameLine = funnelNameLine(count, names);
  return (
    <button
      type="button"
      onClick={onOpenLeads}
      aria-label={
        empty
          ? "0 people waiting for the next send"
          : `${count} people waiting for the next send${
              nextLabel ? `, next ${nextLabel}` : ""
            }`
      }
      className="group/waitn relative inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-[12px] font-semibold tabular-nums text-slate-600 hover:text-slate-800"
    >
      <User className="h-3.5 w-3.5" aria-hidden />
      {count}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-white shadow-sm group-hover/waitn:block"
      >
        <span className="block">
          {empty ? "Nobody waiting yet" : `${count} waiting for the next send`}
        </span>
        {!empty && nextLabel ? (
          <span className="mt-0.5 block font-normal text-white/80">
            Next {nextLabel}
          </span>
        ) : null}
        {nameLine ? (
          <span className="mt-0.5 block font-normal text-white/80">
            {nameLine}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function WaitRow({
  step,
  stepIndex,
  peopleHere,
  waitNames,
  nextLabel,
  onOpenLeads,
  onChange,
  onCommit,
  onDelete,
  onDuplicate,
  onReorderDragStart,
  onReorderDragEnd,
  showPeople = true,
}: {
  step: SequenceStep;
  stepIndex: number;
  peopleHere: number;
  waitNames: string[];
  nextLabel: string | null;
  onOpenLeads: () => void;
  onChange: (patch: Partial<SequenceStep>) => void;
  onCommit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorderDragStart: () => void;
  onReorderDragEnd: () => void;
  showPeople?: boolean;
}) {
  const inferred = inferWaitDuration(step.wait_hours);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(inferred.amount);
  const [unit, setUnit] = useState<WaitUnit>(inferred.unit);
  const editorRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef(amount);
  const unitRef = useRef(unit);
  amountRef.current = amount;
  unitRef.current = unit;

  function beginEdit() {
    const next = inferWaitDuration(step.wait_hours);
    setAmount(next.amount);
    setUnit(next.unit);
    setEditing(true);
  }

  function applyHours(nextHours: number) {
    onChange({ wait_hours: nextHours });
  }

  function finishEdit() {
    applyHours(waitToHours(amountRef.current, unitRef.current));
    setEditing(false);
    onCommit();
  }

  useEffect(() => {
    if (!editing) return;
    function onDoc(event: MouseEvent) {
      if (!editorRef.current?.contains(event.target as Node)) finishEdit();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === "Escape") finishEdit();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [editing, onCommit, onChange]);

  return (
    <div className="group/wait flex items-center gap-2 px-2">
      <button
        type="button"
        draggable
        aria-label="Drag to reorder"
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", `${STEP_MOVE_PREFIX}${stepIndex}`);
          event.dataTransfer.effectAllowed = "move";
          onReorderDragStart();
        }}
        onDragEnd={onReorderDragEnd}
        className="cursor-grab rounded p-0.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span className="h-px min-w-4 flex-1 bg-slate-200" aria-hidden />
      <div className="relative flex items-center">
        {editing ? (
          <div
            ref={editorRef}
            className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-[#0c5290]/25 bg-sky-50 py-1.5 pl-3 pr-2"
          >
            <Clock className="h-4 w-4 text-[#0c5290]" aria-hidden />
            <input
              type="number"
              min={1}
              max={WAIT_UNIT_MAX[unit]}
              autoFocus
              aria-label="Wait amount"
              value={amount}
              onChange={(e) => {
                const next = Math.min(
                  WAIT_UNIT_MAX[unit],
                  Math.max(1, Number(e.target.value || 1))
                );
                setAmount(next);
                applyHours(waitToHours(next, unit));
              }}
              className="w-12 rounded-full bg-white px-2 py-1 text-center text-sm font-semibold tabular-nums text-[#0c5290] outline-none ring-1 ring-[#0c5290]/20 focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
            />
            <WaitUnitToggle
              unit={unit}
              onChange={(nextUnit) => {
                const nextAmount = Math.min(
                  WAIT_UNIT_MAX[nextUnit],
                  Math.max(1, amountRef.current)
                );
                setUnit(nextUnit);
                setAmount(nextAmount);
                applyHours(waitToHours(nextAmount, nextUnit));
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={beginEdit}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[#0c5290] shadow-sm hover:border-[#0c5290] hover:bg-sky-50"
          >
            <Clock className="h-4 w-4" aria-hidden />
            Wait {formatWaitDuration(step.wait_hours)}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          </button>
        )}
        <div className="absolute left-full top-1/2 ml-2 -translate-y-1/2">
          {showPeople ? (
            <WaitPeopleChip
              count={peopleHere}
              names={waitNames}
              nextLabel={nextLabel}
              onOpenLeads={onOpenLeads}
            />
          ) : null}
        </div>
      </div>
      <span className="flex min-w-4 flex-[0.8] items-center pl-10" aria-hidden>
        <span className="h-px w-full bg-slate-200" />
      </span>
      <button
        type="button"
        aria-label="Duplicate wait step"
        onClick={onDuplicate}
        className="group/dup inline-flex items-center gap-0 rounded-full p-1 text-slate-400 opacity-0 transition-all duration-150 hover:gap-1 hover:bg-slate-100 hover:px-2.5 hover:text-slate-700 focus-visible:gap-1 focus-visible:bg-slate-100 focus-visible:px-2.5 focus-visible:text-slate-700 focus-visible:opacity-100 focus-visible:outline-none group-hover/wait:opacity-100"
      >
        <Copy className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-semibold opacity-0 transition-all duration-150 group-hover/dup:max-w-[7.5rem] group-hover/dup:opacity-100 group-focus-visible/dup:max-w-[7.5rem] group-focus-visible/dup:opacity-100">
          Duplicate
        </span>
      </button>
      <button
        type="button"
        aria-label="Delete wait step"
        onClick={() => {
          if (peopleHere > 0) {
            const ok = window.confirm(
              peopleHere === 1
                ? "1 person is waiting here. Delete this wait? They will go on to the next step now."
                : `${peopleHere} people are waiting here. Delete this wait? They will go on to the next step now.`
            );
            if (!ok) return;
          }
          onDelete();
        }}
        className="group/del inline-flex items-center gap-0 rounded-full p-1 text-rose-500 opacity-0 transition-all duration-150 hover:gap-1 hover:bg-rose-50 hover:px-2.5 hover:text-rose-700 focus-visible:gap-1 focus-visible:bg-rose-50 focus-visible:px-2.5 focus-visible:text-rose-700 focus-visible:opacity-100 focus-visible:outline-none group-hover/wait:opacity-100"
      >
        <X className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-semibold opacity-0 transition-all duration-150 group-hover/del:max-w-[7.5rem] group-hover/del:opacity-100 group-focus-visible/del:max-w-[7.5rem] group-focus-visible/del:opacity-100">
          Delete wait step
        </span>
      </button>
    </div>
  );
}

function ChannelToggle({
  label,
  icon: Icon,
  on,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        on
          ? "bg-sky-50 text-[#0c5290]"
          : "bg-slate-100 text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}

function AbVariantPane({
  variant,
  placeholder,
  onChange,
  onCommit,
}: {
  variant: { key: string; label?: string; body: string };
  placeholder?: string;
  onChange: (patch: { label?: string; body?: string }) => void;
  onCommit: () => void;
}) {
  const name = variant.label?.trim() || `Version ${variant.key}`;
  return (
    <MergeFieldComposer
      value={variant.body}
      ariaLabel={name}
      placeholder={placeholder}
      onChange={(body) => onChange({ body })}
      onCommit={onCommit}
    />
  );
}

export function StepInlineEditor({
  step,
  campaignId,
  abStats,
  campaigns,
  onChange,
  onCommit,
  uploadUrl,
  libraryMode = false,
}: {
  step: SequenceStep;
  campaignId: string;
  abStats: Record<string, Record<string, AbVariantStats>> | null;
  campaigns: SequenceCampaignOption[];
  onChange: (patch: Partial<SequenceStep>) => void;
  onCommit: () => void;
  uploadUrl?: string;
  libraryMode?: boolean;
}) {
  const variants = keepAbPair(step.variants ?? []);
  const hasAb = variants.length > 0;
  const allowsAb = campaignStepAllowsVariants(step.step_type);
  const metric = abMetricForStep(step.step_type);
  const stepStats = step.id ? abStats?.[step.id] : undefined;
  const winner = hasAb
    ? abWinningKey(variants, stepStats, metric.key)
    : null;
  const [activeVariantKey, setActiveVariantKey] = useState(
    variants[0]?.key ?? "A"
  );
  const activeVariant =
    variants.find((item) => item.key === activeVariantKey) ?? variants[0];
  const activeIndex = activeVariant
    ? variants.findIndex((item) => item.key === activeVariant.key)
    : 0;

  function patchActiveVariant(patch: Partial<SequenceVariant>) {
    const next = keepAbPair(
      variants.map((item, i) => (i === activeIndex ? { ...item, ...patch } : item))
    );
    onChange({
      variants: next,
      body: next[0]?.body ?? patch.body ?? step.body ?? "",
    });
  }

  function setAbEnabled(on: boolean) {
    if (on === hasAb) return;
    if (on) {
      const body = step.body || "";
      const mediaKind = messageMediaKindFrom(step.config);
      const media = messageMediaFrom(step.config);
      onChange({
        variants: [
          {
            key: "A",
            label: "A",
            body,
            media_kind: mediaKind,
            media,
          },
          {
            key: "B",
            label: "B",
            body,
            media_kind: mediaKind,
            media,
          },
        ],
        body,
      });
      setActiveVariantKey("A");
      onCommit();
      return;
    }
    const source = activeVariant ?? variants[0];
    onChange({
      variants: null,
      body: source?.body ?? step.body ?? "",
      ...(step.step_type === "message"
        ? {
            config: {
              ...(step.config ?? {}),
              media_kind:
                source?.media_kind ?? messageMediaKindFrom(step.config),
              media: source?.media ?? messageMediaFrom(step.config),
            },
          }
        : {}),
    });
    onCommit();
  }

  const abToggle = allowsAb ? (
    <AbTestToggle on={hasAb} onChange={setAbEnabled} />
  ) : null;

  if (step.step_type === "react") {
    return (
      <p className="text-sm leading-relaxed text-slate-500">
        Likes their most recent post. Nothing to write.
      </p>
    );
  }
  if (step.step_type === "instagram_react") {
    return (
      <p className="text-sm leading-relaxed text-slate-500">
        Likes their most recent Instagram post. Needs an Instagram profile on
        the prospect.
      </p>
    );
  }
  if (step.step_type === "instagram_follow") {
    return (
      <p className="text-sm leading-relaxed text-slate-500">
        Follows them on Instagram. Private accounts get a follow request.
      </p>
    );
  }
  if (step.step_type === "visit") {
    return (
      <p className="text-sm leading-relaxed text-slate-500">
        Views their LinkedIn profile so they can see you in Who&apos;s viewed
        your profile.
      </p>
    );
  }
  if (step.step_type === "notify") {
    const channels = notifyConfigFrom(step.config);
    function setChannel(key: "in_app" | "email" | "whatsapp", on: boolean) {
      const next = { ...channels, [key]: on };
      if (!next.in_app && !next.email && !next.whatsapp) return;
      onChange({ config: { ...(step.config ?? {}), ...next } });
      onCommit();
    }
    return (
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-slate-500">
          Alerts you when they reach this point. Pick one channel or several.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <ChannelToggle
            label="Notification"
            icon={Bell}
            on={channels.in_app}
            onChange={(on) => setChannel("in_app", on)}
          />
          <ChannelToggle
            label="Email"
            icon={Mail}
            on={channels.email}
            onChange={(on) => setChannel("email", on)}
          />
          <ChannelToggle
            label="WhatsApp"
            icon={Phone}
            on={channels.whatsapp}
            onChange={(on) => setChannel("whatsapp", on)}
          />
        </div>
      </div>
    );
  }
  if (step.step_type === "add_to_campaign") {
    if (libraryMode) {
      return (
        <p className="text-sm leading-relaxed text-slate-500">
          Adds them to another campaign when this template is used live. Pick
          the destination then.
        </p>
      );
    }
    const targetId = addToCampaignIdFrom(step.config) ?? "";
    return (
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-slate-500">
          Adds them to another campaign when they reach this point.
        </p>
        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-500">No other campaigns yet.</p>
        ) : (
          <label className="block text-xs font-medium text-slate-600">
            Campaign
            <select
              value={targetId}
              onChange={(e) => {
                onChange({
                  config: {
                    ...(step.config ?? {}),
                    campaign_id: e.target.value || null,
                  },
                });
                onCommit();
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-800"
            >
              <option value="">Choose a campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  }
  if (step.step_type === "call") {
    const wait = callWaitFrom(step.config);
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-slate-500">
          You make this call. Notes stay with you.
        </p>
        <fieldset>
          <legend className="text-xs font-medium text-slate-600">
            When they reach this
          </legend>
          <div className="mt-1.5 space-y-1.5">
            <CallWaitOption
              selected={!wait}
              title="Sequence carries on"
              hint="Still shows in Due. You call when you can."
              onSelect={() => {
                onChange({
                  config: { ...(step.config ?? {}), wait: false },
                });
                onCommit();
              }}
            />
            <CallWaitOption
              selected={wait}
              title="Wait until I've called"
              hint="Sequence pauses here until you mark it done."
              onSelect={() => {
                onChange({
                  config: { ...(step.config ?? {}), wait: true },
                });
                onCommit();
              }}
            />
          </div>
        </fieldset>
        <label className="block text-xs font-medium text-slate-600">
          Notes
          <textarea
            value={step.body ?? ""}
            onChange={(e) => onChange({ body: e.target.value })}
            onBlur={onCommit}
            rows={4}
            placeholder="Talking points, what to ask, what a good outcome looks like"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-normal text-slate-800"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {step.step_type === "invite" ? (
        <InviteNoConnectBranch
          config={step.config}
          campaigns={campaigns}
          libraryMode={libraryMode}
          onChange={onChange}
          onCommit={onCommit}
        />
      ) : null}
      {step.step_type === "email" ? (
        <p className="text-xs leading-relaxed text-slate-500">
          Sends from your connected Gmail or Outlook. Start the first line with
          Subject: …
        </p>
      ) : null}
      {step.step_type === "whatsapp" ? (
        <p className="text-xs leading-relaxed text-slate-500">
          Sends on WhatsApp. The prospect needs a phone number.
        </p>
      ) : null}
      {step.step_type === "instagram" ||
      step.step_type === "instagram_comment" ? (
        <p className="text-xs leading-relaxed text-slate-500">
          Sends on Instagram. The prospect needs an Instagram profile URL.
        </p>
      ) : null}
      {step.step_type === "messenger" ? (
        <p className="text-xs leading-relaxed text-slate-500">
          Sends on Facebook Messenger. The prospect needs a Facebook profile URL.
        </p>
      ) : null}

      {hasAb && activeVariant ? (
        <div className="space-y-3">
          <div className="flex w-full items-center justify-between gap-3">
            <div
              className="inline-grid grid-cols-2 rounded-full bg-slate-100 p-0.5"
              role="tablist"
              aria-label="Message versions"
            >
              {variants.map((variant) => {
                const selected = variant.key === activeVariant.key;
                const rate = abRatePercent(
                  stepStats?.[variant.key],
                  metric.key
                );
                const isBest = winner === variant.key;
                const KindIcon =
                  variant.media_kind === "voice"
                    ? Mic
                    : variant.media_kind === "video"
                      ? Video
                      : MessageSquare;
                return (
                  <button
                    key={variant.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveVariantKey(variant.key)}
                    className={`inline-flex items-center justify-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold leading-tight transition duration-150 ${
                      selected
                        ? "bg-[#1a8fd4] text-white"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {step.step_type === "message" ? (
                      <KindIcon className="h-3.5 w-3.5" aria-hidden />
                    ) : null}
                    {variant.key}
                    {isBest || rate != null ? (
                      <span
                        className={`text-[11px] font-medium tabular-nums ${
                          selected ? "text-white/80" : "text-slate-400"
                        }`}
                      >
                        {isBest ? "Best " : ""}
                        {rate != null ? `${rate}%` : ""}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {abToggle ? <div className="ml-auto shrink-0">{abToggle}</div> : null}
          </div>
          {step.step_type === "message" ? (
            <MessageStepMedia
              campaignId={campaignId}
              uploadUrl={uploadUrl}
              mediaKind={activeVariant.media_kind ?? null}
              media={activeVariant.media ?? null}
              onChange={patchActiveVariant}
              onCommit={onCommit}
            />
          ) : null}
          <AbVariantPane
            variant={activeVariant}
            placeholder={messageCopyPlaceholder(
              step.config,
              activeVariant.media_kind
            )}
            onChange={patchActiveVariant}
            onCommit={onCommit}
          />
        </div>
      ) : campaignStepHasCopy(step.step_type) ? (
        <div className="space-y-2">
          {step.step_type === "message" ? (
            <MessageStepMedia
              campaignId={campaignId}
              uploadUrl={uploadUrl}
              mediaKind={messageMediaKindFrom(step.config)}
              media={messageMediaFrom(step.config)}
              trailing={abToggle}
              onChange={(patch) =>
                onChange({ config: { ...(step.config ?? {}), ...patch } })
              }
              onCommit={onCommit}
            />
          ) : abToggle ? (
            <div className="flex justify-end">{abToggle}</div>
          ) : null}
          <MergeFieldComposer
            value={step.body ?? ""}
            placeholder={messageCopyPlaceholder(step.config)}
            onChange={(body) => onChange({ body })}
            onCommit={onCommit}
          />
        </div>
      ) : null}

      {step.send_mode === "remind" ? (
        <ManualSendAfter
          hours={step.fallback_hours}
          onChange={(fallback_hours) => onChange({ fallback_hours })}
          onCommit={onCommit}
        />
      ) : null}
    </div>
  );
}

export function CampaignSequenceBuilder({
  steps,
  campaignId = "",
  peopleAtStep = () => EMPTY_STEP_PEOPLE,
  abStats = null,
  accounts = [],
  connectingProvider = null,
  campaigns = [],
  onAddStep,
  onConnect = () => undefined,
  onPatchStep,
  onCommitSteps,
  onDeleteStep,
  onDuplicateStep,
  onReorderSteps,
  onOpenLeads = () => undefined,
  sidebarExtra,
  mode = "live",
  uploadUrl,
  queuePeople,
  onChooseTemplate,
}: {
  steps: SequenceStep[];
  campaignId?: string;
  peopleAtStep?: (step: SequenceStep, index: number) => StepPeopleCounts;
  abStats?: Record<string, Record<string, AbVariantStats>> | null;
  accounts?: SequenceAccount[];
  connectingProvider?: string | null;
  campaigns?: SequenceCampaignOption[];
  onAddStep: (
    type: CampaignStepType,
    atIndex?: number,
    mediaKind?: CampaignStepMediaKind
  ) => void;
  onConnect?: (provider: UnipileConnectProvider) => void;
  onPatchStep: (index: number, patch: Partial<SequenceStep>) => void;
  onCommitSteps: () => void;
  onDeleteStep: (index: number) => void;
  onDuplicateStep: (index: number) => void;
  onReorderSteps: (next: SequenceStep[]) => void;
  onOpenLeads?: (payload: LeadDrawerPayload) => void;
  sidebarExtra?: ReactNode;
  mode?: "live" | "library";
  uploadUrl?: string;
  queuePeople?: { count: number; names: string[] };
  onChooseTemplate?: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<PaletteGroupId>>(
    () => new Set(["flow", "linkedin", "channels", "instagram"])
  );
  const [dragging, setDragging] = useState<"palette" | "reorder" | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertMenuAt, setInsertMenuAt] = useState<number | null>(null);
  const pickerId = useId();
  const sequenceScrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragging) return;
    setInsertMenuAt(null);
    return startDragAutoScroll(sequenceScrollRootRef.current);
  }, [dragging]);

  const library = mode === "library";
  const firstInviteIndex = steps.findIndex((item) => item.step_type === "invite");
  const emailReady = library || accountOk(accounts, isMailingProvider);
  const whatsappReady = library || accountOk(accounts, (p) => p === "WHATSAPP");
  const instagramReady = library || accountOk(accounts, (p) => p === "INSTAGRAM");
  const messengerReady = library || accountOk(accounts, (p) => p === "MESSENGER");

  const groups: PaletteGroup[] = useMemo(() => {
    const next: PaletteGroup[] = [
      {
        id: "flow",
        title: "Flow",
        items: [
          {
            type: "wait",
            label: "Wait",
            icon: Clock,
            enabled: true,
          },
          {
            type: "notify",
            label: "Notify me",
            hint: "Bell, email, or WhatsApp to you",
            icon: Bell,
            enabled: true,
          },
          {
            type: "call",
            label: "Phone call",
            hint: "You call them. Sequence carries on.",
            icon: PhoneCall,
            enabled: true,
          },
          {
            type: "add_to_campaign",
            label: "Add to other campaign",
            hint: "Enrol them in another sequence",
            icon: FolderInput,
            enabled: true,
          },
        ],
      },
      {
        id: "linkedin",
        title: "LinkedIn",
        items: [
          {
            type: "invite",
            label: "Connection request",
            icon: UserPlus,
            enabled: true,
          },
          {
            type: "message",
            label: "LinkedIn message",
            icon: MessageSquare,
            enabled: true,
          },
          {
            type: "message",
            mediaKind: "voice",
            label: "Voice note",
            icon: Mic,
            enabled: true,
          },
          {
            type: "message",
            mediaKind: "video",
            label: "Video message",
            icon: Video,
            enabled: true,
          },
          {
            type: "react",
            label: "Like post",
            icon: Heart,
            enabled: true,
          },
          {
            type: "comment",
            label: "Comment",
            icon: MessageCircle,
            enabled: true,
          },
          {
            type: "visit",
            label: "View profile",
            icon: Eye,
            enabled: true,
          },
          {
            type: "follow",
            label: "Follow",
            icon: UserRoundPlus,
            enabled: true,
          },
        ],
      },
      {
        id: "channels",
        title: "Other channels",
        items: [
          {
            type: "email",
            label: "Email",
            icon: Mail,
            enabled: emailReady,
            connectProvider: "GOOGLE",
          },
          {
            type: "whatsapp",
            label: "WhatsApp",
            icon: Phone,
            enabled: whatsappReady,
            connectProvider: "WHATSAPP",
          },
          {
            type: "messenger",
            label: "Messenger",
            icon: MessageCircle,
            enabled: messengerReady,
            connectProvider: "MESSENGER",
          },
          ...(instagramReady
            ? []
            : [
                {
                  type: "instagram" as const,
                  label: "Instagram",
                  info: "Message, like posts, comment, and follow.",
                  icon: MessageSquare,
                  enabled: false,
                  connectProvider: "INSTAGRAM" as const,
                },
              ]),
        ],
      },
    ];
    if (instagramReady) {
      next.push({
        id: "instagram",
        title: "Instagram",
        items: [
          {
            type: "instagram",
            label: "Instagram message",
            icon: MessageSquare,
            enabled: true,
          },
          {
            type: "instagram_react",
            label: "Like post",
            icon: Heart,
            enabled: true,
          },
          {
            type: "instagram_comment",
            label: "Comment",
            icon: MessageCircle,
            enabled: true,
          },
          {
            type: "instagram_follow",
            label: "Follow",
            icon: UserRoundPlus,
            enabled: true,
          },
        ],
      });
    }
    if (library) {
      return next.map((group) => ({
        ...group,
        items: group.items
          .filter((item) => item.type !== "add_to_campaign")
          .map((item) => ({ ...item, connectProvider: undefined })),
      }));
    }
    return next;
  }, [emailReady, whatsappReady, instagramReady, messengerReady, library]);

  function toggleGroup(id: PaletteGroupId) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandIndex(index: number, type: CampaignStepType) {
    if (type === "wait") return;
    setExpanded(new Set([index]));
  }

  function addAt(
    type: CampaignStepType,
    atIndex?: number,
    mediaKind?: CampaignStepMediaKind
  ) {
    const insertAt = atIndex ?? steps.length;
    onAddStep(type, atIndex, mediaKind);
    expandIndex(insertAt, type);
    setDropAt(null);
    setInsertMenuAt(null);
  }

  function handleGapDrop(event: React.DragEvent, insertAt: number) {
    const from = parseMoveIndex(event);
    if (from != null) {
      const next = moveSequenceItem(steps, from, insertAt).map((step, i) => ({
        ...step,
        position: i,
      }));
      onReorderSteps(next);
      setDropAt(null);
      setDragging(null);
      return;
    }
    const dragged = parseDragType(event);
    if (dragged) addAt(dragged.type, insertAt, dragged.mediaKind);
  }

  function toggle(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function duplicateAt(index: number) {
    onDuplicateStep(index);
    const insertAt = index + 1;
    setExpanded((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        next.add(i >= insertAt ? i + 1 : i);
      }
      return next;
    });
  }

  const allExpanded =
    steps.length > 0 &&
    steps.every((s, i) => s.step_type === "wait" || expanded.has(i));
  const allStepsSendMode = sequenceMessageSendMode(steps);

  function setAllSendModes(mode: "auto" | "remind") {
    if (allStepsSendMode === mode) return;
    onReorderSteps(
      steps.map((step) =>
        campaignStepHasSendMode(step.step_type)
          ? { ...step, ...campaignSendModePatch(mode, step.fallback_hours) }
          : step
      )
    );
  }

  const insertGap = (insertAt: number) => {
    const before = steps[insertAt - 1];
    const after = steps[insertAt];
    const atEnd = insertAt === steps.length;
    const showAdd =
      atEnd ||
      Boolean(
        before &&
          after &&
          before.step_type !== "wait" &&
          after.step_type !== "wait"
      );
    return (
    <DropGap
      insertAt={insertAt}
      dragging={Boolean(dragging)}
      dropAt={dropAt}
      dropEffect={dragging === "reorder" ? "move" : "copy"}
      onDragOverGap={() => setDropAt(insertAt)}
      onDropGap={(event) => handleGapDrop(event, insertAt)}
      showAdd={showAdd}
      menuOpen={showAdd && insertMenuAt === insertAt}
      onToggleMenu={() =>
        setInsertMenuAt((current) => (current === insertAt ? null : insertAt))
      }
      onCloseMenu={() => setInsertMenuAt(null)}
      groups={groups}
      connectingProvider={connectingProvider}
      onAdd={(type, mediaKind) => addAt(type, insertAt, mediaKind)}
      onConnect={onConnect}
    />
    );
  };

  return (
    <ContentWithRail className="mt-4 min-h-[60vh]">
      <ContentWithRailMain>
        <div ref={sequenceScrollRootRef}>
        {steps.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {`${steps.length} step${steps.length === 1 ? "" : "s"}`}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {allStepsSendMode ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  All steps
                </span>
                <SendModeToggle
                  mode={
                    allStepsSendMode === "mixed" ? null : allStepsSendMode
                  }
                  ariaLabel="Send mode for all steps"
                  onChange={setAllSendModes}
                />
              </div>
            ) : null}
            {steps.some((s) => s.step_type !== "wait") ? (
              <button
                type="button"
                onClick={() =>
                  setExpanded(
                    allExpanded
                      ? new Set()
                      : new Set(
                          steps
                            .map((s, i) => (s.step_type === "wait" ? -1 : i))
                            .filter((i) => i >= 0)
                        )
                  )
                }
                className="text-xs font-medium text-[#0c5290] hover:underline"
              >
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            ) : null}
          </div>
        </div>
        ) : null}

        {steps.length === 0 ? (
          <div
            className={`rounded-2xl border border-dashed px-6 transition ${
              dragging
                ? "border-[#0c5290] bg-sky-50/60"
                : "border-slate-200"
            } ${pickerOpen || onChooseTemplate ? "py-6" : "py-14"}`}
            onDragOver={(event) => {
              if (isMergeFieldDrag()) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDropAt(0);
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleGapDrop(event, 0);
            }}
          >
            {pickerOpen ? (
              <div className="text-center">
                <button
                  type="button"
                  aria-expanded
                  aria-controls={pickerId}
                  onClick={() => setPickerOpen(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add steps
                </button>
                <p className="mt-3 text-sm text-slate-500">
                  Pick an action, or drag one from the list.
                </p>
              </div>
            ) : onChooseTemplate ? (
              <div className="mx-auto max-w-lg text-center">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  No steps yet
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Write the sequence, or start from a template. Add people once
                  the steps are in place.
                </p>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex min-h-[7.25rem] flex-col items-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-4 text-left hover:border-[#0c5290] hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0c5290]">
                      <Plus className="h-5 w-5" strokeWidth={2.1} aria-hidden />
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold text-slate-900">
                        Add steps
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                        Build the invite and follow-ups yourself.
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onChooseTemplate}
                    className="flex min-h-[7.25rem] flex-col items-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-4 text-left hover:border-[#0c5290] hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0c5290]">
                      <LayoutTemplate
                        className="h-5 w-5"
                        strokeWidth={2.1}
                        aria-hidden
                      />
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold text-slate-900">
                        Choose from template
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                        Start from a sequence that is already written.
                      </span>
                    </span>
                  </button>
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  Or drag an action from the list.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <button
                  type="button"
                  aria-expanded={false}
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0c5290] px-6 py-3 text-base font-semibold text-white hover:bg-[#0a4578] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
                >
                  <Plus className="h-5 w-5" aria-hidden />
                  Add steps
                </button>
                <p className="mt-3 text-sm text-slate-500">
                  Or drag an action from the list.
                </p>
              </div>
            )}
            {pickerOpen ? (
              <div id={pickerId} className="mt-5 space-y-4">
                {groups.map((group) => (
                  <div key={group.id}>
                    <p className="px-2 text-xs font-semibold text-slate-700">
                      {group.title}
                    </p>
                    <ul className="mt-1">
                      {group.items.map((item) => (
                        <PaletteItemRow
                          key={item.label}
                          item={item}
                          variant="menu"
                          connectingProvider={connectingProvider}
                          onAdd={(type, mediaKind) =>
                            addAt(type, undefined, mediaKind)
                          }
                          onConnect={onConnect}
                          onDragStart={() => setDragging("palette")}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropAt(null);
                          }}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            {insertGap(0)}
            {steps.map((step, idx) => {
              const people = peopleAtStep(step, idx);
              const open = expanded.has(idx);
              const Icon = stepIcon(step);
              const incompleteHint = open
                ? null
                : campaignStepIncompleteHint(step);
              const stepTitle = campaignStepDisplayLabel(
                step.step_type,
                step.config,
                step.variants
              );
              const preview = stepPreview(step, campaigns);
              const stepPosition = step.position ?? idx;
              return (
                <div key={step.id || `${step.step_type}-${idx}`}>
                  {!library && idx === firstInviteIndex ? (
                    <div className="py-2">
                      <QueueRow
                        count={queuePeople?.count ?? 0}
                        names={queuePeople?.names ?? []}
                        onOpenLeads={() =>
                          onOpenLeads({
                            kind: "hopper",
                            hopper: "staging",
                            title: "Set to send",
                          })
                        }
                      />
                    </div>
                  ) : null}
                  {step.step_type === "wait" ? (
                    <div
                      onDragOver={(event) => {
                        if (isMergeFieldDrag()) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect =
                          dragging === "reorder" ? "move" : "copy";
                        setDropAt(idx + 1);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleGapDrop(event, idx + 1);
                      }}
                    >
                      <WaitRow
                        step={step}
                        stepIndex={idx}
                        peopleHere={people.here}
                        waitNames={people.wait?.names ?? []}
                        nextLabel={people.wait?.nextLabel ?? null}
                        onOpenLeads={() =>
                          onOpenLeads({
                            kind: "wait",
                            position: stepPosition,
                            title: `Wait ${formatWaitDuration(step.wait_hours)}`,
                          })
                        }
                        onChange={(patch) => onPatchStep(idx, patch)}
                        onCommit={onCommitSteps}
                        onDelete={() => onDeleteStep(idx)}
                        onDuplicate={() => duplicateAt(idx)}
                        onReorderDragStart={() => setDragging("reorder")}
                        onReorderDragEnd={() => {
                          setDragging(null);
                          setDropAt(null);
                        }}
                        showPeople={!library}
                      />
                    </div>
                  ) : (
                    <article
                      className="rounded-xl border border-slate-200 bg-white"
                      onDragOver={(event) => {
                        if (isMergeFieldDrag()) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect =
                          dragging === "reorder" ? "move" : "copy";
                        setDropAt(idx + 1);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleGapDrop(event, idx + 1);
                      }}
                    >
                      <div className="flex items-stretch">
                        <button
                          type="button"
                          draggable
                          aria-label="Drag to reorder"
                          onDragStart={(event) => {
                            event.dataTransfer.setData(
                              "text/plain",
                              `${STEP_MOVE_PREFIX}${idx}`
                            );
                            event.dataTransfer.effectAllowed = "move";
                            setDragging("reorder");
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropAt(null);
                          }}
                          className="flex shrink-0 cursor-grab items-center px-1.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" aria-hidden />
                        </button>
                        <div className="min-w-0 flex-1 py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                              <Icon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <p className="flex min-w-0 flex-1 items-center gap-1.5 pt-px text-sm font-semibold text-slate-900">
                              <span className="shrink-0">
                                {stepTitle}
                              </span>
                              {incompleteHint ? (
                                <span
                                  className="group/warn relative inline-flex shrink-0 text-rose-600"
                                  aria-label={incompleteHint}
                                >
                                  <CircleAlert
                                    className="h-4 w-4"
                                    aria-hidden
                                  />
                                  <span
                                    role="tooltip"
                                    className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-max max-w-[14rem] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-center text-[11px] font-medium leading-snug text-white shadow-sm group-hover/warn:block"
                                  >
                                    {incompleteHint}
                                  </span>
                                </span>
                              ) : null}
                            </p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {step.step_type === "invite" &&
                              inviteNoConnectFrom(step.config)
                                .on_no_connect === "other_campaign" ? (
                                <span className="inline-flex shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                                  If no connect
                                </span>
                              ) : null}
                              {step.step_type === "call" ? (
                                callWaitFrom(step.config) ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950">
                                    <PhoneCall
                                      className="h-3 w-3"
                                      aria-hidden
                                    />
                                    Waits
                                  </span>
                                ) : (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    <Bell className="h-3 w-3" aria-hidden />
                                    Reminder
                                  </span>
                                )
                              ) : null}
                              {campaignStepHasSendMode(step.step_type) ? (
                                <SendModeToggle
                                  mode={campaignStepSendMode(step.send_mode)}
                                  onChange={(mode) => {
                                    onPatchStep(
                                      idx,
                                      campaignSendModePatch(
                                        mode,
                                        step.fallback_hours
                                      )
                                    );
                                    onCommitSteps();
                                  }}
                                />
                              ) : null}
                            </div>
                          </div>
                          {!open ? (
                            <div className="mt-1.5 flex items-end gap-2 pl-10">
                              {preview ? (
                                <button
                                  type="button"
                                  aria-expanded={open}
                                  onClick={() => toggle(idx)}
                                  className="min-w-0 flex-1 text-left text-[13px] leading-relaxed text-slate-600 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
                                >
                                  <span className="line-clamp-3 max-w-prose">
                                    {step.step_type === "react" ||
                                    step.step_type === "visit" ||
                                    step.step_type === "instagram_react" ||
                                    step.step_type === "instagram_follow" ||
                                    step.step_type === "notify" ||
                                    step.step_type === "add_to_campaign" ||
                                    step.step_type === "call" ? (
                                      preview
                                    ) : (
                                      <MergeFieldPreview text={preview} />
                                    )}
                                  </span>
                                </button>
                              ) : (
                                <span className="min-w-0 flex-1" />
                              )}
                              <StepDiscloseButton
                                open={open}
                                onToggle={() => toggle(idx)}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {people.invite && !library ? (
                        <InviteFunnelBar
                          invite={people.invite}
                          roundBottom={!open}
                          onOpenSlice={(slice, title) =>
                            onOpenLeads({
                              kind: "invite",
                              slice,
                              position: stepPosition,
                              title,
                            })
                          }
                        />
                      ) : null}
                      {open ? (
                        <div
                          className={`space-y-3 px-4 py-4 sm:px-5 ${
                            people.invite && !library ? "" : "border-t border-slate-100"
                          }`}
                        >
                          <StepInlineEditor
                            step={step}
                            campaignId={campaignId}
                            uploadUrl={uploadUrl}
                            libraryMode={library}
                            abStats={abStats}
                            campaigns={campaigns}
                            onChange={(patch) => onPatchStep(idx, patch)}
                            onCommit={onCommitSteps}
                          />
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => duplicateAt(idx)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                              >
                                <Copy className="h-3.5 w-3.5" aria-hidden />
                                Duplicate
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteStep(idx)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                Delete
                              </button>
                            </div>
                            <StepDiscloseButton
                              open={open}
                              onToggle={() => toggle(idx)}
                            />
                          </div>
                        </div>
                      ) : null}
                    </article>
                  )}
                  {insertGap(idx + 1)}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </ContentWithRailMain>

      <ContentWithRailAside className="lg:top-24">
        {sidebarExtra ? <div className="mb-4">{sidebarExtra}</div> : null}
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="px-1.5 text-sm font-semibold text-slate-900">
            Actions
          </p>
          <p className="mt-0.5 px-1.5 text-[11px] leading-snug text-slate-500">
            Drag onto the sequence.
          </p>
          <div className="mt-3 space-y-2">
            {groups.map((group) => {
              const open = openGroups.has(group.id);
              return (
                <div key={group.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between rounded-md bg-slate-200/90 px-2.5 py-2 text-left hover:bg-slate-200"
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      {group.title}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${
                        open ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                  {open ? (
                    <ul className="pb-1">
                      {group.items.map((item) => (
                        <PaletteItemRow
                          key={item.label}
                          item={item}
                          connectingProvider={connectingProvider}
                          onAdd={(type, mediaKind) => addAt(type, undefined, mediaKind)}
                          onConnect={onConnect}
                          onDragStart={() => setDragging("palette")}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropAt(null);
                          }}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </ContentWithRailAside>
    </ContentWithRail>
  );
}
