"use client";

import { ListFilter, Plus, Trash2, X } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { FIT_OPTIONS } from "@/lib/pool/fit";
import { POOL_OUTREACH_STATUS_OPTIONS } from "@/lib/pool/outreachStatus";
import {
  POOL_HEADCOUNT_FILTER_OPTIONS,
  poolSourceLabel,
} from "@/lib/pool/poolPeople";
import {
  createSmartGroup,
  createSmartRule,
  SMART_ANY_CAMPAIGN,
  SMART_RULE_FIELDS,
  smartRuleFieldMeta,
  type PoolSmartRules,
  type SmartGroup,
  type SmartMatch,
  type SmartRule,
  type SmartRuleField,
} from "@/lib/pool/smartListRules";

type Props = {
  name: string;
  rules: PoolSmartRules;
  onChange: (rules: PoolSmartRules) => void;
  onClose: () => void;
  /** People who match right now, and everyone in Lead Lists. */
  matchCount: number;
  totalCount: number;
  loading?: boolean;
  tagOptions: string[];
  campaigns: Array<{ id: string; name: string }>;
  sourceOptions: string[];
};

/**
 * Smart list rules (job 301). Changes apply as you make them: the table and
 * count behind update live, and the tab saves itself.
 */
export function SmartListRulesPanel(props: Props) {
  const { rules, onChange } = props;

  function setItems(items: PoolSmartRules["items"]) {
    onChange({ ...rules, items });
  }

  function updateRule(id: string, patch: Partial<SmartRule>, groupId?: string) {
    setItems(
      rules.items.map((item) => {
        if (groupId) {
          if (item.kind !== "group" || item.id !== groupId) return item;
          return {
            ...item,
            rules: item.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
          };
        }
        return item.kind === "rule" && item.id === id ? { ...item, ...patch } : item;
      })
    );
  }

  function removeRule(id: string, groupId?: string) {
    if (groupId) {
      setItems(
        rules.items
          .map((item) =>
            item.kind === "group" && item.id === groupId
              ? { ...item, rules: item.rules.filter((rule) => rule.id !== id) }
              : item
          )
          .filter((item) => item.kind !== "group" || item.rules.length > 0)
      );
      return;
    }
    setItems(rules.items.filter((item) => item.id !== id));
  }

  function addRuleToGroup(groupId: string) {
    setItems(
      rules.items.map((item) =>
        item.kind === "group" && item.id === groupId
          ? { ...item, rules: [...item.rules, createSmartRule()] }
          : item
      )
    );
  }

  function setGroupMatch(groupId: string, match: SmartMatch) {
    setItems(
      rules.items.map((item) =>
        item.kind === "group" && item.id === groupId ? { ...item, match } : item
      )
    );
  }

  return (
    <aside
      role="dialog"
      aria-label={`Rules for ${props.name}`}
      className="fixed inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[85] flex max-h-[72vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_16px_40px_-16px_rgba(15,23,42,0.4)] md:inset-x-auto md:bottom-3 md:right-3 md:top-[4.5rem] md:max-h-none md:w-[30rem]"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
            <ListFilter className="h-3.5 w-3.5" aria-hidden />
            Smart list
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900">{props.name}</h2>
          <p className="mt-0.5 text-sm text-slate-600" aria-live="polite">
            {props.loading
              ? "Counting…"
              : `${props.matchCount.toLocaleString()} of ${props.totalCount.toLocaleString()} people match`}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close rules"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <MatchSwitch
          match={rules.match}
          onChange={(match) => onChange({ ...rules, match })}
          label="Match"
        />

        <ol className="space-y-2">
          {rules.items.map((item, index) => (
            <li key={item.id}>
              {index > 0 ? <Joiner match={rules.match} /> : null}
              {item.kind === "group" ? (
                <GroupBox
                  group={item}
                  props={props}
                  onMatch={(match) => setGroupMatch(item.id, match)}
                  onRule={(id, patch) => updateRule(id, patch, item.id)}
                  onRemoveRule={(id) => removeRule(id, item.id)}
                  onAddRule={() => addRuleToGroup(item.id)}
                  onRemove={() => removeRule(item.id)}
                />
              ) : (
                <RuleRow
                  rule={item}
                  props={props}
                  onChange={(patch) => updateRule(item.id, patch)}
                  onRemove={() => removeRule(item.id)}
                />
              )}
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setItems([...rules.items, createSmartRule()])}
            className={buttonClass("second", "small")}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Rule
          </button>
          <button
            type="button"
            onClick={() => setItems([...rules.items, createSmartGroup()])}
            className={buttonClass("second", "small")}
            title="A set of rules with its own all / any"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Group
          </button>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs leading-snug text-slate-600">
          People join and leave by themselves as they match. You can't add or
          remove people by hand.
        </p>
        <button type="button" onClick={props.onClose} className={buttonClass("main", "small", "shrink-0")}>
          Done
        </button>
      </footer>
    </aside>
  );
}

/** Active option: solid bright blue, white text (app-wide toggle look). */
const SWITCH_ON = "bg-sky-600 text-white";
const SWITCH_OFF = "text-slate-700 hover:bg-white";

function MatchSwitch({
  match,
  onChange,
  label,
}: {
  match: SmartMatch;
  onChange: (match: SmartMatch) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <span>{label}</span>
      <div className="inline-flex rounded-md bg-slate-100 p-0.5" role="radiogroup" aria-label={label}>
        {(["all", "any"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={match === option}
            onClick={() => onChange(option)}
            className={`rounded px-2.5 py-1 text-xs font-semibold ${
              match === option ? SWITCH_ON : SWITCH_OFF
            }`}
          >
            {option === "all" ? "All" : "Any"}
          </button>
        ))}
      </div>
      <span>of these</span>
    </div>
  );
}

function Joiner({ match }: { match: SmartMatch }) {
  return (
    <p className="py-1 pl-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {match === "all" ? "and" : "or"}
    </p>
  );
}

function GroupBox({
  group,
  props,
  onMatch,
  onRule,
  onRemoveRule,
  onAddRule,
  onRemove,
}: {
  group: SmartGroup;
  props: Props;
  onMatch: (match: SmartMatch) => void;
  onRule: (id: string, patch: Partial<SmartRule>) => void;
  onRemoveRule: (id: string) => void;
  onAddRule: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <MatchSwitch match={group.match} onChange={onMatch} label="Match" />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove group"
          className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <ol className="space-y-1.5">
        {group.rules.map((rule, index) => (
          <li key={rule.id}>
            {index > 0 ? <Joiner match={group.match} /> : null}
            <RuleRow
              rule={rule}
              props={props}
              onChange={(patch) => onRule(rule.id, patch)}
              onRemove={() => onRemoveRule(rule.id)}
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onAddRule}
        className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-sky-700 hover:bg-white"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Rule in this group
      </button>
    </div>
  );
}

function RuleRow({
  rule,
  props,
  onChange,
  onRemove,
}: {
  rule: SmartRule;
  props: Props;
  onChange: (patch: Partial<SmartRule>) => void;
  onRemove: () => void;
}) {
  const meta = smartRuleFieldMeta(rule.field);
  const select = fieldClass("select", "small", "w-auto min-w-0");
  const showDays =
    rule.field === "status" && rule.op === "is" && rule.value && rule.value !== "none";

  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      <select
        aria-label="What to check"
        value={rule.field}
        onChange={(e) => {
          const next = createSmartRule(e.target.value as SmartRuleField);
          onChange({ field: next.field, op: next.op, value: next.value, when: "any", days: null });
        }}
        className={select}
      >
        {SMART_RULE_FIELDS.map((field) => (
          <option key={field.key} value={field.key}>
            {field.label}
          </option>
        ))}
      </select>
      <select
        aria-label="How to compare"
        value={rule.op}
        onChange={(e) => onChange({ op: e.target.value })}
        className={select}
      >
        {meta.ops.map((op) => (
          <option key={op.key} value={op.key}>
            {op.label}
          </option>
        ))}
      </select>
      <RuleValue rule={rule} props={props} onChange={onChange} />
      {showDays ? (
        <>
          <select
            aria-label="For how long"
            value={rule.when}
            onChange={(e) =>
              onChange({
                when: e.target.value as SmartRule["when"],
                days: e.target.value === "any" ? null : (rule.days ?? 90),
              })
            }
            className={select}
          >
            <option value="any">any time</option>
            <option value="more">for more than</option>
            <option value="less">for less than</option>
          </select>
          {rule.when !== "any" ? <DaysInput rule={rule} onChange={onChange} /> : null}
        </>
      ) : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove rule"
        className="mt-1 shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function DaysInput({
  rule,
  onChange,
  suffix = "days",
}: {
  rule: SmartRule;
  onChange: (patch: Partial<SmartRule>) => void;
  suffix?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
      <input
        type="number"
        min={0}
        max={3650}
        inputMode="numeric"
        aria-label="Number of days"
        value={rule.days ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange({ days: raw === "" ? null : Math.max(0, Math.round(Number(raw))) });
        }}
        className={fieldClass("input", "small", "w-20")}
      />
      {suffix}
    </span>
  );
}

function RuleValue({
  rule,
  props,
  onChange,
}: {
  rule: SmartRule;
  props: Props;
  onChange: (patch: Partial<SmartRule>) => void;
}) {
  const meta = smartRuleFieldMeta(rule.field);
  const select = fieldClass("select", "small", "w-auto min-w-0 max-w-[12rem]");
  const pick = (placeholder: string, options: Array<{ key: string; label: string }>) => (
    <select
      aria-label="Value"
      value={rule.value}
      onChange={(e) => onChange({ value: e.target.value })}
      className={select}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  );

  switch (meta.value) {
    case "tag":
      return pick(
        "Pick a tag",
        props.tagOptions.map((tag) => ({ key: tag, label: tag }))
      );
    case "status":
      return pick(
        "Pick a status",
        POOL_OUTREACH_STATUS_OPTIONS.map((option) => ({ key: option.key, label: option.label }))
      );
    case "campaign":
      return (
        <select
          aria-label="Campaign"
          value={rule.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className={select}
        >
          <option value={SMART_ANY_CAMPAIGN}>any campaign</option>
          {props.campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      );
    case "fit":
      return pick("Pick a fit", [
        ...FIT_OPTIONS.map((option) => ({ key: option.key, label: option.short })),
        { key: "none", label: "Not checked" },
      ]);
    case "headcount":
      return pick(
        "Pick a size",
        POOL_HEADCOUNT_FILTER_OPTIONS.map((option) => ({ key: option.key, label: option.label }))
      );
    case "contact":
      return pick("Pick one", [
        { key: "email", label: "an email" },
        { key: "phone", label: "a phone" },
      ]);
    case "source":
      return pick(
        "Pick a source",
        props.sourceOptions.map((source) => ({ key: source, label: poolSourceLabel(source) }))
      );
    case "text":
      return (
        <input
          aria-label="Value"
          value={rule.value}
          placeholder={meta.placeholder}
          onChange={(e) => onChange({ value: e.target.value })}
          className={fieldClass("input", "small", "w-36")}
        />
      );
    case "days":
      return <DaysInput rule={rule} onChange={onChange} suffix="days ago" />;
    default:
      return null;
  }
}
