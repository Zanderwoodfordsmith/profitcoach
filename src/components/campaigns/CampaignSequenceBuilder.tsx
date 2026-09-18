"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronDown,
  CircleAlert,
  Clock,
  Eye,
  FolderInput,
  GripVertical,
  Heart,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  Phone,
  PhoneCall,
  UserPlus,
  UserRoundPlus,
  Video,
  X,
  Zap,
} from "lucide-react";
import {
  addToCampaignIdFrom,
  campaignStepAllowsVariants,
  campaignStepDisplayLabel,
  campaignStepHasCopy,
  campaignStepIncompleteHint,
  callWaitFrom,
  inviteNoConnectFrom,
  isCampaignStepType,
  messageMediaKindFrom,
  notifyChannelSummary,
  notifyConfigFrom,
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
  variants?: Array<{ key: string; label?: string; body: string }> | null;
  send_mode?: "auto" | "remind" | null;
  fallback_hours?: number | null;
  fallback_body?: string | null;
  config?: Record<string, unknown> | null;
};

export type SequenceCampaignOption = {
  id: string;
  name: string;
};

type LeadDrawerPayload = {
  kind: "step";
  position: number;
  title: string;
};

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
  icon: LucideIcon;
  enabled: boolean;
  connectProvider?: UnipileConnectProvider;
  soon?: boolean;
};

type PaletteGroupId = "linkedin" | "instagram" | "channels" | "timing" | "your-side";

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
}: {
  item: PaletteItem;
  connectingProvider: string | null;
  onAdd: (type: CampaignStepType, mediaKind?: CampaignStepMediaKind) => void;
  onConnect: (provider: UnipileConnectProvider) => void;
  onDragStart: (type: CampaignStepType) => void;
  onDragEnd: () => void;
}) {
  const Icon = item.icon;
  if (item.enabled && item.type) {
    return (
      <li>
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(
              "text/plain",
              paletteDragValue(item.type!, item.mediaKind)
            );
            event.dataTransfer.effectAllowed = "copy";
            onDragStart(item.type!);
          }}
          onDragEnd={onDragEnd}
          onClick={() => onAdd(item.type!, item.mediaKind)}
          className="flex w-full cursor-grab items-start gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-white active:cursor-grabbing"
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
          <span className="block text-sm font-medium text-slate-400">
            {item.label}
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
  config: Record<string, unknown> | null | undefined
) {
  const kind = messageMediaKindFrom(config);
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

function SendModeBadge({ mode }: { mode: "auto" | "remind" }) {
  if (mode === "remind") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950">
        <Bell className="h-3 w-3" aria-hidden />
        Remind me
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-[#0c5290]">
      <Zap className="h-3 w-3" aria-hidden />
      Auto
    </span>
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
}: {
  insertAt: number;
  dragging: boolean;
  dropAt: number | null;
  dropEffect: "copy" | "move";
  onDragOverGap: () => void;
  onDropGap: (event: React.DragEvent) => void;
}) {
  const hot = dragging && dropAt === insertAt;

  return (
    <div
      className={`relative flex items-center justify-center transition-[height] duration-150 ${
        hot ? "h-10" : dragging ? "h-6" : "h-3"
      }`}
      onDragOver={(event) => {
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
        className={`absolute inset-x-10 h-px transition ${
          hot
            ? "bg-[#0c5290]"
            : dragging
              ? "bg-slate-200"
              : "bg-transparent"
        }`}
      />
    </div>
  );
}

function WaitRow({
  step,
  stepIndex,
  onChange,
  onCommit,
  onDelete,
  onReorderDragStart,
  onReorderDragEnd,
}: {
  step: SequenceStep;
  stepIndex: number;
  onChange: (patch: Partial<SequenceStep>) => void;
  onCommit: () => void;
  onDelete: () => void;
  onReorderDragStart: () => void;
  onReorderDragEnd: () => void;
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
      {editing ? (
        <div
          ref={editorRef}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-2"
        >
          <Clock className="h-4 w-4 text-slate-400" aria-hidden />
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
            className="w-12 border-0 bg-transparent p-0 text-center text-sm tabular-nums text-slate-700 outline-none"
          />
          <label className="relative inline-flex items-center">
            <span className="sr-only">Wait unit</span>
            <select
              value={unit}
              onChange={(e) => {
                const nextUnit = e.target.value as WaitUnit;
                const nextAmount = Math.min(
                  WAIT_UNIT_MAX[nextUnit],
                  Math.max(1, amount)
                );
                setUnit(nextUnit);
                setAmount(nextAmount);
                applyHours(waitToHours(nextAmount, nextUnit));
              }}
              className="cursor-pointer appearance-none rounded-full border-0 bg-transparent py-0.5 pl-1 pr-5 text-sm text-slate-600 outline-none hover:bg-slate-50"
            >
              {WAIT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0.5 h-3 w-3 text-slate-400"
              aria-hidden
            />
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={beginEdit}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-slate-600 hover:bg-white hover:text-slate-800"
        >
          <Clock className="h-4 w-4" aria-hidden />
          Wait {formatWaitDuration(step.wait_hours)}
        </button>
      )}
      <button
        type="button"
        aria-label="Remove wait"
        onClick={onDelete}
        className="rounded-full p-0.5 text-slate-300 opacity-0 hover:text-rose-600 group-hover/wait:opacity-100 focus:opacity-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span className="h-px min-w-4 flex-1 bg-slate-200" aria-hidden />
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
  rate,
  isBest,
  placeholder,
  onChange,
  onCommit,
}: {
  variant: { key: string; label?: string; body: string };
  rate: number | null;
  isBest: boolean;
  placeholder?: string;
  onChange: (patch: { label?: string; body?: string }) => void;
  onCommit: () => void;
}) {
  const name = variant.label?.trim() || `Version ${variant.key}`;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Version name</span>
          <input
            value={variant.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            onBlur={onCommit}
            placeholder={`Version ${variant.key}`}
            className="w-full rounded-md bg-transparent px-0.5 py-0.5 text-xs font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400 hover:text-[#0c5290] focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
          />
        </label>
        {isBest || rate != null ? (
          <span className="shrink-0 text-[11px] font-normal tabular-nums text-slate-400">
            {isBest ? (
              <span className="font-semibold text-[#0c5290]">Best</span>
            ) : null}
            {rate != null ? (
              <span className={isBest ? " ml-1 text-[#0c5290]" : " ml-1"}>
                {rate}%
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      <MergeFieldComposer
        value={variant.body}
        ariaLabel={name}
        placeholder={placeholder}
        onChange={(body) => onChange({ body })}
        onCommit={onCommit}
      />
    </div>
  );
}

function StepInlineEditor({
  step,
  campaignId,
  abStats,
  campaigns,
  onChange,
  onCommit,
}: {
  step: SequenceStep;
  campaignId: string;
  abStats: Record<string, Record<string, AbVariantStats>> | null;
  campaigns: SequenceCampaignOption[];
  onChange: (patch: Partial<SequenceStep>) => void;
  onCommit: () => void;
}) {
  const variants = step.variants ?? [];
  const hasAb = variants.length > 0;
  const metric = abMetricForStep(step.step_type);
  const stepStats = step.id ? abStats?.[step.id] : undefined;
  const winner = hasAb
    ? abWinningKey(variants, stepStats, metric.key)
    : null;

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
    <div className="space-y-3">
      {step.step_type === "invite" ? (
        <InviteNoConnectBranch
          config={step.config}
          campaigns={campaigns}
          onChange={onChange}
          onCommit={onCommit}
        />
      ) : null}
      {step.step_type === "message" ? (
        <MessageStepMedia
          campaignId={campaignId}
          config={step.config}
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

      {step.step_type === "message" ||
      campaignStepAllowsVariants(step.step_type) ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {step.step_type === "message" ? (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              Send
              <select
                value={step.send_mode === "remind" ? "remind" : "auto"}
                onChange={(e) => {
                  onChange({
                    send_mode: e.target.value as "auto" | "remind",
                    ...(e.target.value === "auto"
                      ? { fallback_hours: null, fallback_body: null }
                      : {}),
                  });
                  onCommit();
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
              >
                <option value="auto">Auto</option>
                <option value="remind">Remind me</option>
              </select>
            </label>
          ) : (
            <span />
          )}
          {campaignStepAllowsVariants(step.step_type) ? (
            <button
              type="button"
              role="switch"
              aria-checked={hasAb}
              onClick={() => {
                if (hasAb) {
                  onChange({
                    variants: null,
                    body: step.variants?.[0]?.body ?? step.body ?? "",
                  });
                } else {
                  const body = step.body || "";
                  onChange({
                    variants: [
                      { key: "A", label: "Version A", body },
                      { key: "B", label: "Version B", body },
                    ],
                    body,
                  });
                }
                onCommit();
              }}
              className="text-xs font-medium text-[#0c5290] hover:underline"
            >
              {hasAb ? "Turn off A/B" : "A/B test"}
            </button>
          ) : null}
        </div>
      ) : null}

      {step.send_mode === "remind" ? (
        <label className="block text-xs font-medium text-slate-600">
          Fallback after (hours)
          <input
            type="number"
            min={1}
            max={720}
            value={step.fallback_hours ?? ""}
            onChange={(e) =>
              onChange({
                fallback_hours: e.target.value ? Number(e.target.value) : null,
              })
            }
            onBlur={onCommit}
            className="mt-1 w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
          />
        </label>
      ) : null}

      {hasAb ? (
        <div
          className={`grid grid-cols-1 gap-4 ${
            variants.length > 1 ? "sm:grid-cols-2" : ""
          }`}
        >
          {variants.map((variant, index) => (
            <div
              key={variant.key}
              className={
                index === variants.length - 1 && variants.length % 2 === 1
                  ? "sm:col-span-2"
                  : ""
              }
            >
              <AbVariantPane
                variant={variant}
                rate={abRatePercent(stepStats?.[variant.key], metric.key)}
                isBest={winner === variant.key}
                placeholder={messageCopyPlaceholder(step.config)}
                onChange={(patch) => {
                  const next = variants.map((item, i) =>
                    i === index ? { ...item, ...patch } : item
                  );
                  onChange({
                    variants: next,
                    body: next[0]?.body || patch.body || "",
                  });
                }}
                onCommit={onCommit}
              />
            </div>
          ))}
        </div>
      ) : campaignStepHasCopy(step.step_type) ? (
        <MergeFieldComposer
          value={step.body ?? ""}
          placeholder={messageCopyPlaceholder(step.config)}
          onChange={(body) => onChange({ body })}
          onCommit={onCommit}
        />
      ) : null}
    </div>
  );
}

export function CampaignSequenceBuilder({
  steps,
  campaignId,
  countAtStep,
  abStats,
  accounts,
  connectingProvider,
  campaigns = [],
  onAddStep,
  onConnect,
  onPatchStep,
  onCommitSteps,
  onDeleteStep,
  onReorderSteps,
  onOpenLeads,
  sidebarExtra,
}: {
  steps: SequenceStep[];
  campaignId: string;
  countAtStep: (step: SequenceStep, index: number) => number;
  abStats: Record<string, Record<string, AbVariantStats>> | null;
  accounts: SequenceAccount[];
  connectingProvider: string | null;
  campaigns?: SequenceCampaignOption[];
  onAddStep: (
    type: CampaignStepType,
    atIndex?: number,
    mediaKind?: CampaignStepMediaKind
  ) => void;
  onConnect: (provider: UnipileConnectProvider) => void;
  onPatchStep: (index: number, patch: Partial<SequenceStep>) => void;
  onCommitSteps: () => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (next: SequenceStep[]) => void;
  onOpenLeads: (payload: LeadDrawerPayload) => void;
  sidebarExtra?: ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<PaletteGroupId>>(
    () => new Set(["linkedin", "instagram", "channels", "timing", "your-side"])
  );
  const [dragging, setDragging] = useState<"palette" | "reorder" | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const sequenceScrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragging) return;
    return startDragAutoScroll(sequenceScrollRootRef.current);
  }, [dragging]);

  const emailReady = accountOk(accounts, isMailingProvider);
  const whatsappReady = accountOk(accounts, (p) => p === "WHATSAPP");
  const instagramReady = accountOk(accounts, (p) => p === "INSTAGRAM");
  const messengerReady = accountOk(accounts, (p) => p === "MESSENGER");

  const groups: PaletteGroup[] = useMemo(
    () => [
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
        id: "instagram",
        title: "Instagram",
        items: [
          {
            type: "instagram",
            label: "Instagram message",
            icon: MessageSquare,
            enabled: instagramReady,
            connectProvider: "INSTAGRAM",
          },
          {
            type: "instagram_react",
            label: "Like post",
            icon: Heart,
            enabled: instagramReady,
            connectProvider: "INSTAGRAM",
          },
          {
            type: "instagram_comment",
            label: "Comment",
            icon: MessageCircle,
            enabled: instagramReady,
            connectProvider: "INSTAGRAM",
          },
          {
            type: "instagram_follow",
            label: "Follow",
            icon: UserRoundPlus,
            enabled: instagramReady,
            connectProvider: "INSTAGRAM",
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
        ],
      },
      {
        id: "timing",
        title: "Timing",
        items: [
          {
            type: "wait",
            label: "Wait",
            icon: Clock,
            enabled: true,
          },
        ],
      },
      {
        id: "your-side",
        title: "Your side",
        items: [
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
    ],
    [emailReady, whatsappReady, instagramReady, messengerReady]
  );

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

  const allExpanded =
    steps.length > 0 &&
    steps.every((s, i) => s.step_type === "wait" || expanded.has(i));

  const insertGap = (insertAt: number) => (
    <DropGap
      insertAt={insertAt}
      dragging={Boolean(dragging)}
      dropAt={dropAt}
      dropEffect={dragging === "reorder" ? "move" : "copy"}
      onDragOverGap={() => setDropAt(insertAt)}
      onDropGap={(event) => handleGapDrop(event, insertAt)}
    />
  );

  return (
    <ContentWithRail className="mt-4 min-h-[60vh]">
      <ContentWithRailMain>
        <div ref={sequenceScrollRootRef}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {steps.length === 0
              ? "Drag an action onto the sequence"
              : `${steps.length} step${steps.length === 1 ? "" : "s"}`}
          </p>
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

        {steps.length === 0 ? (
          <div
            className={`rounded-2xl border border-dashed px-6 py-16 text-center transition ${
              dragging
                ? "border-[#0c5290] bg-sky-50/60"
                : "border-slate-200"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDropAt(0);
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleGapDrop(event, 0);
            }}
          >
            <p className="text-sm text-slate-600">No steps yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Drag Notify me, a message, or any other action from the right.
            </p>
          </div>
        ) : (
          <div>
            {insertGap(0)}
            {steps.map((step, idx) => {
              const count = countAtStep(step, idx);
              const open = expanded.has(idx);
              const Icon = stepIcon(step);
              const incompleteHint = open
                ? null
                : campaignStepIncompleteHint(step);
              const stepTitle = campaignStepDisplayLabel(
                step.step_type,
                step.config
              );
              const preview = stepPreview(step, campaigns);
              return (
                <div key={step.id || `${step.step_type}-${idx}`}>
                  {step.step_type === "wait" ? (
                    <div
                      onDragOver={(event) => {
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
                        onChange={(patch) => onPatchStep(idx, patch)}
                        onCommit={onCommitSteps}
                        onDelete={() => onDeleteStep(idx)}
                        onReorderDragStart={() => setDragging("reorder")}
                        onReorderDragEnd={() => {
                          setDragging(null);
                          setDropAt(null);
                        }}
                      />
                    </div>
                  ) : (
                    <article
                      className="rounded-xl border border-slate-200 bg-white"
                      onDragOver={(event) => {
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
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => toggle(idx)}
                          className="flex min-w-0 flex-1 items-start gap-3 py-3 pr-4 text-left hover:bg-slate-50/80"
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-900">
                                <span className="min-w-0 truncate">
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
                              <span className="mt-0.5 flex shrink-0 flex-wrap items-center justify-end gap-1">
                                {step.step_type === "message" ? (
                                  <SendModeBadge
                                    mode={
                                      step.send_mode === "remind"
                                        ? "remind"
                                        : "auto"
                                    }
                                  />
                                ) : null}
                                {step.step_type === "invite" &&
                                inviteNoConnectFrom(step.config).on_no_connect ===
                                  "other_campaign" ? (
                                  <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                                    If no connect
                                  </span>
                                ) : null}
                                {step.step_type === "call" ? (
                                  callWaitFrom(step.config) ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950">
                                      <PhoneCall className="h-3 w-3" aria-hidden />
                                      Waits
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                      <Bell className="h-3 w-3" aria-hidden />
                                      Reminder
                                    </span>
                                  )
                                ) : null}
                              </span>
                            </div>
                            {!open && preview ? (
                              <p className="mt-1 line-clamp-3 max-w-prose text-xs leading-relaxed text-slate-500">
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
                              </p>
                            ) : null}
                          </div>
                          <ChevronDown
                            className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${
                              open ? "rotate-180" : ""
                            }`}
                            aria-hidden
                          />
                        </button>
                        {count > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenLeads({
                                kind: "step",
                                position: step.position ?? idx,
                                title: stepTitle,
                              })
                            }
                            className="shrink-0 border-l border-slate-100 px-3 text-xs font-semibold tabular-nums text-slate-700 hover:bg-slate-50"
                          >
                            {count}
                          </button>
                        ) : (
                          <span className="w-2 shrink-0" aria-hidden />
                        )}
                      </div>
                      {open ? (
                        <div className="space-y-3 border-t border-slate-100 px-4 py-4 sm:px-5">
                          <StepInlineEditor
                            step={step}
                            campaignId={campaignId}
                            abStats={abStats}
                            campaigns={campaigns}
                            onChange={(patch) => onPatchStep(idx, patch)}
                            onCommit={onCommitSteps}
                          />
                          <button
                            type="button"
                            onClick={() => onDeleteStep(idx)}
                            className="text-xs font-medium text-rose-600 hover:underline"
                          >
                            Delete
                          </button>
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
