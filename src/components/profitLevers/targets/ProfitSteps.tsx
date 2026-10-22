"use client";

import { useState, type ReactNode } from "react";

import {
  RATES,
  amount,
  gainIfHit,
  labelRows,
  lineFor,
  lineStatus,
  lowerIsBetter,
  needsFor,

  pounds,
  rangeFor,
  rateText,
  unitOf,
  volumesOf,
  type Numbers,
  type RateKey,
  type Volumes,
} from "@/lib/profitTargets";

import { TargetPath, type Need } from "./TargetPath";
import { TargetSlider } from "./TargetSlider";
import { TargetStatus } from "./TargetStatus";
import { TargetTip } from "./TargetTip";

export type ProfitTarget = { label: string; target: number };

type Props = {
  /** Their numbers now. */
  now: Numbers;
  /** Where the dots are: their numbers, or a what-if. */
  ours: Numbers;
  /** Drag sets their numbers, or tries a what-if. */
  mode: "set" | "whatif";
  /** Typed (`typed`) or dragged in "set" mode. */
  onNow: (key: keyof Numbers, value: number, typed?: boolean) => void;
  /** Dragged in "what if" mode. */
  onOurs: (key: keyof Numbers, value: number) => void;
  /** Each step's target. */
  targets: Record<RateKey, number>;
  defaults: Record<RateKey, number>;
  onTarget: (key: RateKey, value: number | null) => void;
  /** The £ profit targets switched on, smallest first. */
  profitTargets: ProfitTarget[];
  costs: boolean;
  order: "funnel" | "gap";
  /** Their numbers when the page opened or were last typed, so a bar's scale stays put while its dot is dragged. */
  anchor: Numbers;
};

type YearKey = keyof Volumes;
const COLUMNS = 9;
const SAME = 1e-9;

/** What each step makes in a year: the volume half of its row. */
const YEAR_OF: Record<RateKey, { key: YearKey; label: string; format: (value: number) => string; note: string }> = {
  costPerLead: { key: "spend", label: "Marketing spend", format: pounds, note: "Marketing spend: leads × cost per lead." },
  meetingRate: { key: "meetings", label: "Meetings or quotes", format: amount, note: "Meetings or quotes a year." },
  winRate: { key: "customers", label: "New customers", format: amount, note: "New customers a year." },
  timesBought: { key: "orders", label: "Orders", format: amount, note: "Orders a year: customers × times they buy." },
  averageSale: { key: "sales", label: "Sales", format: pounds, note: "Sales a year: orders × average sale." },
  margin: { key: "grossProfit", label: "Gross profit", format: pounds, note: "Gross profit a year: sales × gross margin." },
};

/** Leads first, as ActionCOACH does; cost per lead sits under it when costs are on. */
const GROUPS: Array<{ label: string; keys: RateKey[]; leads?: true }> = [
  { label: "Leads", keys: ["costPerLead"], leads: true },
  { label: "Customers", keys: ["meetingRate", "winRate"] },
  { label: "Value", keys: ["timesBought", "averageSale", "margin"] },
];

function InfoIcon() {
  return (
    <svg className="tgt-step-name__icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.2v3.8M8 4.9v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StepName({ name, why }: { name: string; why: string }) {
  return (
    <TargetTip tip={why} className="tgt-step-name">
      <span className="tgt-row-name">{name}</span>
      <InfoIcon />
    </TargetTip>
  );
}

/** Now minus target in the step's own units, green when better and red when worse. */
function Diff({ value, target, keyName }: { value: number; target: number; keyName: RateKey }) {
  const gap = value - target;
  const shown = rateText(keyName, Math.abs(gap));
  if (Math.abs(gap) < SAME || /^£?0(%|×)?$/.test(shown)) return <td className="tgt-num tgt-diff tgt-tight tgt-muted">0</td>;
  const better = lowerIsBetter(keyName) ? gap < 0 : gap > 0;
  return (
    <td className={better ? "tgt-num tgt-diff tgt-tight is-better" : "tgt-num tgt-diff tgt-tight is-worse"}>
      {gap > 0 ? "+" : "−"}
      {shown}
    </td>
  );
}

/** A number box for their figure. Rates are typed as whole percents (50 for 50%). */
function NowInput({ label, value, unit, onChange, suffix }: { label: string; value: number; unit: "percent" | "pounds" | "times" | "count"; onChange: (value: number) => void; suffix?: string }) {
  const shown = unit === "percent" ? Math.round(value * 1000) / 10 : Math.round(value * 100) / 100;
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="pl-input">
      {unit === "pounds" ? <span className="pl-input__unit">£</span> : null}
      <input
        inputMode="decimal"
        aria-label={`${label} now`}
        value={draft ?? (shown ? String(shown) : "")}
        onChange={(event) => {
          const text = event.target.value.replace(/[£,%×\s]/g, "");
          setDraft(text);
          const parsed = text === "" ? 0 : Number(text);
          if (!Number.isFinite(parsed) || parsed < 0) return;
          onChange(unit === "percent" ? Math.min(parsed, 100) / 100 : parsed);
        }}
        onBlur={() => setDraft(null)}
      />
      {unit === "percent" ? <span className="pl-input__unit">%</span> : unit === "times" ? <span className="pl-input__unit">×</span> : null}
      {suffix ? <span className="pl-input__unit">{suffix}</span> : null}
    </span>
  );
}

/**
 * The table, as on the BCA Targets tab. One row per step: its rate against target (bands; the dot is them, drag it)
 * and what it makes a year against what each £ profit target needs.
 */
export function ProfitSteps({ now, ours, mode, onNow, onOurs, targets, defaults, onTarget, profitTargets, costs, order, anchor }: Props) {
  const setting = mode === "set";
  const changed = !setting && (Object.keys(now) as Array<keyof Numbers>).some((key) => Math.abs(now[key] - ours[key]) > SAME);
  const yearNow = volumesOf(now);
  const yearOurs = volumesOf(ours);
  const needsAt = (numbers: Numbers) => profitTargets.map(({ label, target }) => ({ label, target, need: needsFor(target, numbers, costs) }));
  const needs = needsAt(ours);
  const needsNow = needsAt(now);
  const biggest = Math.max(...profitTargets.map(({ target }) => target));
  const headRows = labelRows(profitTargets.map(({ target }) => target / biggest), 0.3);
  const needsOf = (key: YearKey): Need[] => needs.map(({ label, target, need }) => ({ label, target, value: need[key] }));
  const topWas = (key: YearKey) => needsNow.find(({ target }) => target === biggest)?.need[key];
  const yearCell = (key: YearKey, format: (value: number) => string, label: string, extra?: { note?: string; onChange?: (value: number) => void; step?: number }) =>
    profitTargets.length > 0 ? (
      <TargetPath
        value={yearOurs[key]}
        actual={yearNow[key]}
        moved={changed}
        needs={needsOf(key)}
        topWas={topWas(key)}
        format={format}
        label={label}
        {...extra}
      />
    ) : (
      <>
        <td className="tgt-num tgt-month">{format(yearOurs[key])}</td>
        <td />
      </>
    );
  const shownRates = RATES.filter((rate) => costs || !rate.costs);
  const gains = Object.fromEntries(shownRates.map(({ key }) => [key, gainIfHit(now, key, targets[key], costs)])) as Partial<Record<RateKey, number>>;

  const groupRow = (label: string) => (
    <tr key={`group-${label}`} className="tgt-group-row">
      <th scope="rowgroup" colSpan={COLUMNS}>
        {label}
      </th>
    </tr>
  );

  const rateRow = (key: RateKey) => {
    const def = RATES.find((rate) => rate.key === key)!;
    const lower = lowerIsBetter(key);
    const line = lineFor(targets[key], lower);
    const moved = Math.abs(ours[key] - now[key]) > SAME;
    const gain = gains[key];
    const year = YEAR_OF[key];
    const unit = unitOf(key);
    return (
      <tr key={key}>
        <th scope="row">
          <StepName name={def.label} why={def.why} />
        </th>
        <td className="tgt-num tgt-target tgt-tight">{rateText(key, targets[key])}</td>
        <td className="tgt-num tgt-tight">
          {setting ? (
            <NowInput label={def.label} value={now[key]} unit={unit} onChange={(value) => onNow(key, value, true)} />
          ) : (
            <TargetTip tip={moved ? `Now ${rateText(key, now[key])}.` : ""} end className={`tgt-value${moved ? " is-whatif" : ""}`}>
              {rateText(key, ours[key])}
            </TargetTip>
          )}
        </td>
        <Diff value={ours[key]} target={targets[key]} keyName={key} />
        <td className="tgt-num tgt-gain tgt-tight">{gain !== undefined && gain >= 1 ? `+${pounds(gain)}` : ""}</td>
        <td className="tgt-bar-col">
          <TargetSlider
            label={def.label}
            value={ours[key]}
            from={setting ? undefined : now[key]}
            line={line}
            range={rangeFor(key, anchor[key], targets[key])}
            lowerIsBetter={lower}
            onChange={(value) => (setting ? onNow(key, value) : onOurs(key, value))}
            format={(value) => rateText(key, value)}
            edit={{
              defaultLine: lineFor(defaults[key], lower),
              onDraft: (next) => onTarget(key, Math.abs(next.good - defaults[key]) < SAME ? null : next.good),
              onSave: async (next) => {
                if (!next) onTarget(key, null);
                return null;
              },
            }}
          />
        </td>
        <td>
          <TargetStatus status={lineStatus(ours[key], line, lower)} />
        </td>
        {yearCell(year.key, year.format, year.label, { note: year.note })}
      </tr>
    );
  };

  /** Leads a month: typed, or dragged on its year bar. Everything below follows. */
  const leadsRow = (
    <tr key="leads" className="tgt-input-row">
      <th scope="row">
        <StepName name="Leads" why="New enquiries. Type them a month; the bar shows a year. Drag the bar to try more or fewer, and everything below follows." />
      </th>
      <td />
      <td className="tgt-num tgt-tight">
        {setting ? (
          <NowInput label="Leads a month" value={now.leads} unit="count" suffix="a month" onChange={(value) => onNow("leads", value, true)} />
        ) : (
          <span className={`tgt-value${Math.abs(ours.leads - now.leads) > SAME ? " is-whatif" : ""}`}>{amount(ours.leads)} a month</span>
        )}
      </td>
      <td />
      <td />
      <td />
      <td />
      {yearCell("leads", amount, "Leads", {
        note: "Leads a year.",
        onChange: (value) => (setting ? onNow("leads", value / 12) : onOurs("leads", value / 12)),
        step: 1,
      })}
    </tr>
  );

  const overheadsRow = (
    <tr key="overheads" className="tgt-input-row">
      <th scope="row">
        <StepName name="Overheads" why="Everything else the business costs a year: wages, rent, software. Not the direct costs, which gross margin already takes off." />
      </th>
      <td />
      <td className="tgt-num tgt-tight">
        {setting ? (
          <NowInput label="Overheads a year" value={now.overheads} unit="pounds" onChange={(value) => onNow("overheads", value, true)} />
        ) : (
          <span className="tgt-value">{pounds(ours.overheads)}</span>
        )}
      </td>
      <td />
      <td />
      <td />
      <td />
      <td className="tgt-num tgt-month">{pounds(ours.overheads)}</td>
      <td />
    </tr>
  );

  const netRow = (
    <tr key="net">
      <th scope="row">
        <StepName name="Net profit" why="Gross profit, less marketing spend and overheads." />
      </th>
      <td />
      <td />
      <td />
      <td />
      <td />
      <td />
      {yearCell("netProfit", pounds, "Net profit", { note: "Gross profit − marketing − overheads." })}
    </tr>
  );

  const keysOf = (keys: RateKey[]) => keys.filter((key) => costs || key !== "costPerLead");
  const byGap = keysOf(GROUPS.flatMap((group) => group.keys)).sort((a, b) => (gains[b] ?? -1) - (gains[a] ?? -1));
  const head = (children: ReactNode, tip: string) => (
    <TargetTip tip={tip} end>
      {children}
    </TargetTip>
  );

  return (
    <div className="tgt-scroll">
      <table className="tgt-grid-table tgt-one-table">
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col" className="tgt-num tgt-tight">
              Target
            </th>
            <th scope="col" className="tgt-num tgt-tight">
              Now
            </th>
            <th scope="col" className="tgt-num tgt-tight">
              {head("Diff", "Now minus target. 55% against a 50% target is +5%.")}
            </th>
            <th scope="col" className="tgt-num tgt-tight">
              {head("If hit", "What hitting that one target adds to profit a year, with everything else as it is now.")}
            </th>
            <th scope="col" className="tgt-bar-col">
              <span className="dash-sr">Now against target</span>
            </th>
            <th scope="col">
              <TargetTip tip="On target, Close (within 20% short of it) or Off target.">Status</TargetTip>
            </th>
            <th scope="col" className="tgt-num tgt-month">
              A year
            </th>
            <th scope="col" className="tgt-bar-col">
              <span className={headRows.includes(1) ? "tgt-vhead pl-two-rows" : "tgt-vhead"}>
                {profitTargets.map(({ label, target }, i) => (
                  <span
                    key={label}
                    className={`tgt-vhead__label${target === biggest ? " is-end" : ""}${headRows[i] ? " is-up" : ""}`}
                    style={target === biggest ? undefined : { left: `calc((100% - 3.2em - 10px) * ${target / biggest})` }}
                  >
                    {label}
                  </span>
                ))}
              </span>
            </th>
          </tr>
        </thead>
        {order === "funnel" ? (
          GROUPS.map((group) => (
            <tbody key={group.label}>
              {groupRow(group.label)}
              {group.leads ? leadsRow : null}
              {keysOf(group.keys).map(rateRow)}
            </tbody>
          ))
        ) : (
          <tbody>
            {groupRow("Biggest gap first")}
            {leadsRow}
            {byGap.map(rateRow)}
          </tbody>
        )}
        {costs ? (
          <tbody className="tgt-result">
            {groupRow("Costs")}
            {overheadsRow}
            {netRow}
          </tbody>
        ) : null}
      </table>
      <p className="pl-foot">It&rsquo;s what&rsquo;s possible on paper, not a forecast.</p>
    </div>
  );
}
