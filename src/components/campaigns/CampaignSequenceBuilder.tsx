"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronDown,
  Clock,
  Eye,
  FolderInput,
  Heart,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  UserPlus,
  UserRoundPlus,
  X,
  Zap,
} from "lucide-react";
import {
  addToCampaignIdFrom,
  campaignStepAllowsVariants,
  campaignStepHasCopy,
  campaignStepTypeLabel,
  callWaitFrom,
  notifyChannelSummary,
  notifyConfigFrom,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
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

type PaletteItem = {
  type?: CampaignStepType;
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
  onAdd: (type: CampaignStepType) => void;
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
              `${STEP_DRAG_PREFIX}${item.type}`
            );
            event.dataTransfer.effectAllowed = "copy";
            onDragStart(item.type!);
          }}
          onDragEnd={onDragEnd}
          onClick={() => onAdd(item.type!)}
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

const STEP_DRAG_PREFIX = "pc-step:";

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

function accountOk(
  accounts: SequenceAccount[],
  match: (provider: string) => boolean
) {
  return accounts.some(
    (a) => a.status === "OK" && match(normalizeUnipileProvider(a.provider))
  );
}

function parseDragType(event: React.DragEvent): CampaignStepType | null {
  const raw =
    event.dataTransfer.getData("text/plain") ||
    event.dataTransfer.getData("text");
  if (!raw.startsWith(STEP_DRAG_PREFIX)) return null;
  const type = raw.slice(STEP_DRAG_PREFIX.length);
  return type in STEP_ICONS ? (type as CampaignStepType) : null;
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
  onDragOverGap,
  onDropGap,
}: {
  insertAt: number;
  dragging: boolean;
  dropAt: number | null;
  onDragOverGap: () => void;
  onDropGap: (type: CampaignStepType) => void;
}) {
  const hot = dragging && dropAt === insertAt;

  return (
    <div
      className={`relative flex items-center justify-center transition-[height] duration-150 ${
        hot ? "h-10" : dragging ? "h-6" : "h-3"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        onDragOverGap();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const type = parseDragType(event);
        if (type) onDropGap(type);
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
  onChange,
  onCommit,
  onDelete,
}: {
  step: SequenceStep;
  onChange: (patch: Partial<SequenceStep>) => void;
  onCommit: () => void;
  onDelete: () => void;
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

function StepInlineEditor({
  step,
  abStats,
  campaigns,
  onChange,
  onCommit,
}: {
  step: SequenceStep;
  abStats: Record<string, Record<string, AbVariantStats>> | null;
  campaigns: SequenceCampaignOption[];
  onChange: (patch: Partial<SequenceStep>) => void;
  onCommit: () => void;
}) {
  const variants = step.variants ?? [];
  const hasAb = variants.length > 0;
  const [abKey, setAbKey] = useState(variants[0]?.key ?? "A");
  const activeVariant =
    variants.find((v) => v.key === abKey) ?? variants[0] ?? null;
  const activeIndex = activeVariant
    ? variants.findIndex((v) => v.key === activeVariant.key)
    : -1;
  const metric = abMetricForStep(step.step_type);
  const stepStats = step.id ? abStats?.[step.id] : undefined;
  const winner = hasAb
    ? abWinningKey(variants, stepStats, metric.key)
    : null;

  useEffect(() => {
    if (!hasAb) return;
    if (!variants.some((v) => v.key === abKey)) {
      setAbKey(variants[0]?.key ?? "A");
    }
  }, [abKey, hasAb, variants]);

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
                  setAbKey("A");
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

      {hasAb && activeVariant ? (
        <div>
          <div
            role="tablist"
            aria-label="A/B versions"
            className="flex flex-col gap-0.5 rounded-lg bg-slate-100 p-0.5"
          >
            {variants.map((v) => {
              const selected = v.key === activeVariant.key;
              const stats = stepStats?.[v.key];
              const rate = abRatePercent(stats, metric.key);
              const isBest = winner === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={v.label || v.key}
                  onClick={() => setAbKey(v.key)}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                    selected
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {v.label?.trim() || v.key}
                  </span>
                  <span className="shrink-0 font-normal tabular-nums text-slate-400">
                    {isBest ? (
                      <span className="font-semibold text-[#0c5290]">Best</span>
                    ) : null}
                    {rate != null ? (
                      <span className={isBest ? " ml-1 text-[#0c5290]" : " ml-1"}>
                        {rate}%
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="mt-2 block text-[11px] font-medium text-slate-500">
            Version name
            <input
              value={activeVariant.label ?? ""}
              onChange={(e) => {
                const next = [...variants];
                next[activeIndex] = {
                  ...activeVariant,
                  label: e.target.value,
                };
                onChange({ variants: next });
              }}
              onBlur={onCommit}
              placeholder={`Version ${activeVariant.key}`}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-normal text-slate-800"
            />
          </label>
          <div className="mt-2">
            <MergeFieldComposer
              value={activeVariant.body}
              ariaLabel={activeVariant.label || `Version ${activeVariant.key}`}
              onChange={(body) => {
                const next = [...variants];
                next[activeIndex] = { ...activeVariant, body };
                onChange({
                  variants: next,
                  body: next[0]?.body || body,
                });
              }}
              onCommit={onCommit}
            />
          </div>
        </div>
      ) : campaignStepHasCopy(step.step_type) ? (
        <MergeFieldComposer
          value={step.body ?? ""}
          onChange={(body) => onChange({ body })}
          onCommit={onCommit}
        />
      ) : null}
    </div>
  );
}

export function CampaignSequenceBuilder({
  steps,
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
  onOpenLeads,
  sidebarExtra,
}: {
  steps: SequenceStep[];
  countAtStep: (step: SequenceStep, index: number) => number;
  abStats: Record<string, Record<string, AbVariantStats>> | null;
  accounts: SequenceAccount[];
  connectingProvider: string | null;
  campaigns?: SequenceCampaignOption[];
  onAddStep: (type: CampaignStepType, atIndex?: number) => void;
  onConnect: (provider: UnipileConnectProvider) => void;
  onPatchStep: (index: number, patch: Partial<SequenceStep>) => void;
  onCommitSteps: () => void;
  onDeleteStep: (index: number) => void;
  onOpenLeads: (payload: LeadDrawerPayload) => void;
  sidebarExtra?: ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<PaletteGroupId>>(
    () => new Set(["linkedin", "instagram", "channels", "timing", "your-side"])
  );
  const [dragging, setDragging] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);

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

  function addAt(type: CampaignStepType, atIndex?: number) {
    const insertAt = atIndex ?? steps.length;
    onAddStep(type, atIndex);
    expandIndex(insertAt, type);
    setDropAt(null);
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
      dragging={dragging}
      dropAt={dropAt}
      onDragOverGap={() => setDropAt(insertAt)}
      onDropGap={(type) => addAt(type, insertAt)}
    />
  );

  return (
    <ContentWithRail className="mt-4 min-h-[60vh]">
      <ContentWithRailMain>
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
              const type = parseDragType(event);
              if (type) addAt(type, 0);
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
              const hasAb = Boolean(step.variants && step.variants.length > 0);
              const Icon = STEP_ICONS[step.step_type];
              return (
                <div key={step.id || `${step.step_type}-${idx}`}>
                  {step.step_type === "wait" ? (
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                        setDropAt(idx + 1);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const type = parseDragType(event);
                        if (type) addAt(type, idx + 1);
                      }}
                    >
                      <WaitRow
                        step={step}
                        onChange={(patch) => onPatchStep(idx, patch)}
                        onCommit={onCommitSteps}
                        onDelete={() => onDeleteStep(idx)}
                      />
                    </div>
                  ) : (
                    <article
                      className="rounded-xl border border-slate-200 bg-white"
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                        setDropAt(idx + 1);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const type = parseDragType(event);
                        if (type) addAt(type, idx + 1);
                      }}
                    >
                      <div className="flex items-stretch">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => toggle(idx)}
                          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {campaignStepTypeLabel(step.step_type)}
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
                                {hasAb ? (
                                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    A/B
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            {!open ? (
                              <p className="mt-1 line-clamp-3 max-w-prose text-xs leading-relaxed text-slate-500">
                                {step.step_type === "react" ||
                                step.step_type === "visit" ||
                                step.step_type === "instagram_react" ||
                                step.step_type === "instagram_follow" ||
                                step.step_type === "notify" ||
                                step.step_type === "add_to_campaign" ||
                                step.step_type === "call" ? (
                                  stepPreview(step, campaigns)
                                ) : (
                                  <MergeFieldPreview
                                    text={stepPreview(step, campaigns)}
                                  />
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
                                title: campaignStepTypeLabel(step.step_type),
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
                          onAdd={(type) => addAt(type)}
                          onConnect={onConnect}
                          onDragStart={() => setDragging(true)}
                          onDragEnd={() => {
                            setDragging(false);
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
