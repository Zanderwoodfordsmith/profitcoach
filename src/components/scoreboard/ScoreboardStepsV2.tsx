"use client";

import { useState, type ReactNode } from "react";

import { NowInput as NowInputV1 } from "@/components/profitLevers/targets/ProfitSteps";
import { TargetPath, type Need } from "@/components/profitLevers/targets/TargetPath";
import { TargetSlider } from "@/components/profitLevers/targets/TargetSlider";
import { TargetStatus } from "@/components/profitLevers/targets/TargetStatus";
import { TargetTip } from "@/components/profitLevers/targets/TargetTip";
import { lineStatus, type Status, type TargetLine } from "@/lib/profitTargets";
import type { NumberFrom } from "@/lib/scoreboardData";
import { MAX_CLIENTS, extraGainIfHit, gainIfHitV2, needsForV2, paceText, volumesOfV2, type ExtraSource } from "@/lib/scoreboardV2";
import {
  CALL_KEYS,
  GREAT,
  RANGES,
  RATES,
  SOURCES,
  amount,
  incomeText,
  interestedToClient,
  percent,
  pounds,
  rateText,
  signEveryWeeks,
  targetLabel,
  unitOf,
  type Numbers,
  type RateKey,
  type SourceKey,
  type Volumes,
} from "@/lib/scoreboard";

type Props = {
  /** Their numbers now. */
  now: Numbers;
  /** Where the dots are: their numbers, or a what-if. */
  ours: Numbers;
  onOurs: (key: keyof Numbers, value: number) => void;
  targets: Record<RateKey, number>;
  /** Income targets a month, smallest first. */
  picked: number[];
  order: "funnel" | "gap";
  /** Lead sources the coach added. Typed numbers, so the same now and in a what-if. */
  extra: ExtraSource[];
  onExtra: (id: string, patch: Partial<ExtraSource>) => void;
  onAddExtra: () => void;
  onRemoveExtra: (id: string) => void;
  /** Where each of their numbers came from. */
  from: Partial<Record<keyof Numbers, NumberFrom>>;
};

type MonthKey = keyof Volumes;
const COLUMNS = 9;
const SAME = 1e-9;

/** The count each call step makes a month: the month half of its row. */
const MONTH_OF: Partial<Record<RateKey, { key: MonthKey; label: string; note: string }>> = {
  interestToBook: { key: "booked", label: "Constraint Calls booked", note: "Constraint Calls booked a month." },
  callShow: { key: "callsHeld", label: "Constraint Calls held", note: "Constraint Calls that happen a month." },
  callToRoadmap: { key: "roadmapsBooked", label: "Roadmaps booked", note: "Profit Roadmap calls booked a month." },
  roadmapShow: { key: "roadmapsHeld", label: "Roadmaps held", note: "Profit Roadmap calls that happen a month." },
  closeRate: { key: "newClients", label: "New clients", note: "New clients a month." },
};

const SOURCE_OF: Partial<Record<RateKey, SourceKey>> = Object.fromEntries(SOURCES.map((source) => [source.rate, source.key]));

const GROUPS: Array<{ label: string; keys: RateKey[] }> = [
  { label: "Leads", keys: SOURCES.map((source) => source.rate) },
  { label: "Calls", keys: CALL_KEYS },
  { label: "Keep clients", keys: ["months", "fee"] },
];

/** V1's input, but a real 0 shows as 0 (V2's numbers are their data, so an empty box would read as missing). */
function NowInput(props: Parameters<typeof NowInputV1>[0]) {
  if (props.value !== 0) return <NowInputV1 {...props} />;
  return <ZeroInput {...props} />;
}

function ZeroInput({ label, unit, onChange, suffix, whatif = false }: Parameters<typeof NowInputV1>[0]) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className={whatif ? "pl-input is-whatif" : "pl-input"}>
      {unit === "pounds" ? <span className="pl-input__unit">£</span> : null}
      <input
        inputMode="decimal"
        aria-label={`${label} now`}
        value={draft ?? "0"}
        onChange={(event) => {
          const text = event.target.value.replace(/[£,%×\s]/g, "");
          setDraft(text);
          const parsed = text === "" ? 0 : Number(text);
          if (!Number.isFinite(parsed) || parsed < 0) return;
          onChange(unit === "percent" ? Math.min(parsed, 100) / 100 : parsed);
        }}
        onBlur={() => setDraft(null)}
      />
      {unit === "percent" ? <span className="pl-input__unit">%</span> : null}
      {suffix ? <span className="pl-input__unit">{suffix}</span> : null}
    </span>
  );
}

/** A small percent box for an added source's own target, so the Target column stays narrow. */
function TargetBox({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center justify-end gap-0.5">
      <input
        inputMode="decimal"
        aria-label={label}
        value={draft ?? String(Math.round(value * 1000) / 10)}
        onChange={(event) => {
          const text = event.target.value.replace(/[%\s]/g, "");
          setDraft(text);
          const parsed = text === "" ? 0 : Number(text);
          if (Number.isFinite(parsed) && parsed >= 0) onChange(Math.min(parsed, 100) / 100);
        }}
        onBlur={() => setDraft(null)}
        className="w-10 rounded border border-slate-200 bg-white px-1 py-0.5 text-right text-[14px] focus:border-sky-500 focus:outline-none"
      />
      %
    </span>
  );
}

function InfoIcon() {
  return (
    <svg className="tgt-step-name__icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.2v3.8M8 4.9v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StepName({ name, why, from }: { name: string; why: string; from?: NumberFrom }) {
  return (
    <span className="inline-flex flex-col">
      <TargetTip tip={from ? `${why} Your number now: ${from.text}` : why} className="tgt-step-name">
        <span className="tgt-row-name">{name}</span>
        <InfoIcon />
      </TargetTip>
      {from ? (
        <span className={from.kind === "data" ? "text-[12px] font-normal text-emerald-700" : "text-[12px] font-normal text-slate-500"}>
          {from.kind === "data" ? "Your data" : "Target for now"}
        </span>
      ) : null}
    </span>
  );
}

/** Now minus target in the step's own units, green when better and red when worse. */
function Diff({ value, target, keyName }: { value: number; target: number; keyName: RateKey }) {
  const gap = value - target;
  const shown = rateText(keyName, Math.abs(gap));
  if (Math.abs(gap) < SAME || /^£?0(%| months)?$/.test(shown)) return <td className="tgt-num tgt-diff tgt-tight tgt-muted">0</td>;
  return (
    <td className={gap > 0 ? "tgt-num tgt-diff tgt-tight is-better" : "tgt-num tgt-diff tgt-tight is-worse"}>
      {gap > 0 ? "+" : "−"}
      {shown}
    </td>
  );
}

/** Red below Good, yellow from Good to Great, green at Great. Where there's no Great, Good is green. */
function bandsFor(good: number, great: number): TargetLine {
  return { poor: good, good: Math.max(good, great) };
}

/** Status words for the Good and Great bands. */
function statusOf(value: number, line: TargetLine, hasGreat: boolean): { status: Status; text: string } {
  const status = lineStatus(value, line, false);
  const text = status === "below" ? "Below good" : status === "close" || !hasGreat ? "Good" : "Great";
  return { status, text };
}

function inputUnit(key: RateKey): "percent" | "pounds" | "count" {
  const unit = unitOf(key);
  return unit === "percent" ? "percent" : unit === "pounds" ? "pounds" : "count";
}

/**
 * The table, as on the BCA Targets tab. One row per step: its rate against target (bands; the dot is you, drag it)
 * and what it makes a month against what each £ income target needs.
 */
export function ScoreboardStepsV2({ now, ours, onOurs, targets, picked, order, extra, onExtra, onAddExtra, onRemoveExtra, from }: Props) {
  const changed = (Object.keys(now) as Array<keyof Numbers>).some((key) => Math.abs(now[key] - ours[key]) > SAME);
  const monthNow = volumesOfV2(now, extra);
  const monthOurs = volumesOfV2(ours, extra);
  const needs = picked.map((target) => ({ target, need: needsForV2(target, ours, extra) }));
  const needsNow = picked.map((target) => ({ target, need: needsForV2(target, now, extra) }));
  const biggest = Math.max(...picked);
  const needsOf = (key: MonthKey): Need[] => needs.map(({ target, need }) => ({ label: targetLabel(target), target, value: need[key] }));
  const topWas = (key: MonthKey) => needsNow.find(({ target }) => target === biggest)?.need[key];
  const set = onOurs;

  const monthCell = (
    key: MonthKey,
    format: (value: number) => string,
    label: string,
    extra?: { note?: string; onChange?: (value: number) => void; step?: number; shown?: ReactNode },
  ) => (
    <TargetPath
      value={monthOurs[key]}
      actual={monthNow[key]}
      moved={changed}
      needs={needsOf(key)}
      topWas={topWas(key)}
      format={format}
      label={label}
      per="a month"
      {...extra}
    />
  );
  const gains = Object.fromEntries(RATES.map(({ key }) => [key, gainIfHitV2(now, extra, key, targets[key])])) as Record<RateKey, number>;

  const groupRow = (label: string) => (
    <tr key={`group-${label}`} className="tgt-group-row">
      <th scope="rowgroup" colSpan={COLUMNS}>
        {label}
      </th>
    </tr>
  );

  /** A source's month half: how much of it a month, typed in the box or dragged on the bar. */
  const sourceCell = (source: (typeof SOURCES)[number]) => {
    return monthCell(source.key, amount, source.label, {
      note: `${source.label} a month. Drag the bar to try more or less.`,
      onChange: (value) => set(source.key, value),
      shown: (
        <NowInput
          label={`${source.label} a month`}
          value={ours[source.key]}
          unit="count"
          suffix={source.word}
          whatif={Math.abs(ours[source.key] - now[source.key]) > SAME}
          onChange={(value) => set(source.key, value)}
        />
      ),
    });
  };

  /** Where a row's number came from. A lead row joins the amount and the rate; it's data only if both are. */
  const fromOf = (key: RateKey, sourceKey?: SourceKey): NumberFrom | undefined => {
    const rate = from[key];
    const amountFrom = sourceKey ? from[sourceKey] : undefined;
    if (!rate || !amountFrom) return rate;
    return { kind: rate.kind === "data" && amountFrom.kind === "data" ? "data" : "target", text: `${amountFrom.text} ${rate.text}` };
  };

  const rateRow = (key: RateKey) => {
    const def = RATES.find((rate) => rate.key === key)!;
    const line = bandsFor(targets[key], GREAT[key]);
    const hasGreat = GREAT[key] > targets[key] + SAME;
    const moved = Math.abs(ours[key] - now[key]) > SAME;
    const gain = gains[key];
    const month = MONTH_OF[key];
    const sourceKey = SOURCE_OF[key];
    const source = SOURCES.find((item) => item.key === sourceKey);
    return (
      <tr key={key}>
        <th scope="row">
          <StepName
            name={def.label}
            why={def.why}
            from={fromOf(key, source?.key)}
          />
        </th>
        <td className="tgt-num tgt-target tgt-tight">
          <TargetTip tip={hasGreat ? `Good ${rateText(key, targets[key])}. Great ${rateText(key, GREAT[key])}.` : ""} end>
            {rateText(key, targets[key])}
          </TargetTip>
        </td>
        <td className="tgt-num tgt-tight">
          <NowInput label={def.label} value={ours[key]} unit={inputUnit(key)} whatif={moved} onChange={(value) => set(key, value)} />
        </td>
        <Diff value={ours[key]} target={targets[key]} keyName={key} />
        <td className="tgt-num tgt-gain tgt-tight">{gain >= 1 ? `+${pounds(gain)}` : ""}</td>
        <td className="tgt-bar-col">
          <TargetSlider
            label={def.label}
            value={ours[key]}
            from={now[key]}
            line={line}
            range={RANGES[key]}
            lowerIsBetter={false}
            onChange={(value) => set(key, value)}
            format={(value) => rateText(key, value)}
            card={false}
          />
        </td>
        <td>
          <TargetStatus {...statusOf(ours[key], line, hasGreat)} />
        </td>
        {source ? (
          sourceCell(source)
        ) : month ? (
          monthCell(month.key, amount, month.label, { note: month.note })
        ) : (
          <>
            <td className="tgt-month" />
            <td />
          </>
        )}
      </tr>
    );
  };

  /** A lead source the coach added: its name, target, share interested now, and people a month. */
  const extraRow = (source: ExtraSource, index: number) => {
    const line = bandsFor(source.target, source.target);
    const gain = extraGainIfHit(now, extra, source.id);
    const label = source.name.trim() || "New lead source";
    return (
      <tr key={source.id}>
        <th scope="row">
          <span className="inline-flex items-center gap-1.5">
            <input
              aria-label="Lead source name"
              value={source.name}
              placeholder="Name it, e.g. Referrals"
              maxLength={60}
              onChange={(e) => onExtra(source.id, { name: e.target.value })}
              className="w-32 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="button"
              aria-label={`Remove ${label}`}
              title="Remove"
              onClick={() => onRemoveExtra(source.id)}
              className="rounded px-1 text-[14px] leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ×
            </button>
          </span>
        </th>
        <td className="tgt-num tgt-target tgt-tight">
          <TargetBox label={`${label} target`} value={source.target} onChange={(value) => onExtra(source.id, { target: value })} />
        </td>
        <td className="tgt-num tgt-tight">
          <NowInput label={`${label} to interested`} value={source.rate} unit="percent" whatif={false} onChange={(value) => onExtra(source.id, { rate: value })} />
        </td>
        <td className={source.rate >= source.target - SAME ? "tgt-num tgt-diff tgt-tight tgt-muted" : "tgt-num tgt-diff tgt-tight is-worse"}>
          {Math.abs(source.rate - source.target) < SAME ? "0" : `${source.rate > source.target ? "+" : "−"}${percent(Math.abs(source.rate - source.target))}`}
        </td>
        <td className="tgt-num tgt-gain tgt-tight">{gain >= 1 ? `+${pounds(gain)}` : ""}</td>
        <td className="tgt-bar-col">
          <TargetSlider
            label={`${label} to interested`}
            value={source.rate}
            from={source.rate}
            line={line}
            range={{ min: 0, max: 1, step: 0.01 }}
            lowerIsBetter={false}
            onChange={(value) => onExtra(source.id, { rate: value })}
            format={(value) => percent(value)}
            card={false}
          />
        </td>
        <td>
          <TargetStatus {...statusOf(source.rate, line, false)} />
        </td>
        <TargetPath
          value={source.amount}
          actual={source.amount}
          moved={false}
          needs={needs.map(({ target, need }) => ({ label: targetLabel(target), target, value: need.extra[index] ?? 0 }))}
          topWas={needsNow.find(({ target }) => target === biggest)?.need.extra[index]}
          format={amount}
          label={label}
          per="a month"
          note={`${label}: people a month. Drag the bar to try more or less.`}
          onChange={(value) => onExtra(source.id, { amount: value })}
          shown={
            <NowInput
              label={`${label} a month`}
              value={source.amount}
              unit="count"
              suffix="people"
              whatif={false}
              onChange={(value) => onExtra(source.id, { amount: value })}
            />
          }
        />
      </tr>
    );
  };

  const addRow = (
    <tr key="add-source">
      <th scope="row" colSpan={COLUMNS}>
        <button
          type="button"
          onClick={onAddExtra}
          disabled={extra.length >= 8}
          className="rounded border border-dashed border-slate-300 px-2 py-1 text-[14px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
        >
          + Add a lead source
        </button>
        <span className="ml-2 text-[14px] font-normal text-slate-500">Referrals, a partner like an accountant, an association, events.</span>
      </th>
    </tr>
  );

  const interestedRow = (
    <tr key="interested">
      <th scope="row">
        <StepName name="Interested" why="Everyone interested in a call a month, from every lead source added together." />
      </th>
      <td />
      <td />
      <td />
      <td />
      <td />
      <td />
      {monthCell("interested", amount, "Interested", { note: "Interested people a month, outbound and inbound." })}
    </tr>
  );

  /** The five call rates as one, like Lead to roadmap on the BCA board: worked out from the rows above it. */
  const shareTarget = interestedToClient(targets);
  const shareNow = interestedToClient(now);
  const shareOurs = interestedToClient(ours);
  const shareLine = bandsFor(shareTarget, interestedToClient(GREAT));
  const shareMoved = Math.abs(shareOurs - shareNow) > SAME;
  const shareGain = volumesOfV2({ ...now, ...Object.fromEntries(CALL_KEYS.map((key) => [key, targets[key]])) }, extra).income - monthNow.income;
  /** Interested people it takes to sign one client: 10 at 10%, 2.5 at 40%. */
  const perClient = (share: number) => (share > 0 ? amount(1 / share) : "∞");
  const shareRow = (
    <tr key="share">
      <th scope="row">
        <StepName
          name="Interested to client"
          why={`How many people interested in a call become a client. It's the five call rates above it multiplied: ${CALL_KEYS.map((key) => rateText(key, ours[key])).join(" × ")} = ${rateText("closeRate", shareOurs)}, so 1 client for every ${perClient(shareOurs)} interested. Move those rates to move this.`}
        />
      </th>
      <td className="tgt-num tgt-target tgt-tight">{rateText("closeRate", shareTarget)}</td>
      <td className="tgt-num tgt-tight">
        <TargetTip tip={shareMoved ? `Now ${rateText("closeRate", shareNow)}.` : ""} end className={`tgt-value${shareMoved ? " is-whatif" : ""}`}>
          {rateText("closeRate", shareOurs)}
        </TargetTip>
      </td>
      <Diff value={shareOurs} target={shareTarget} keyName="closeRate" />
      <td className="tgt-num tgt-gain tgt-tight">{shareGain >= 1 ? `+${pounds(shareGain)}` : ""}</td>
      <td className="tgt-bar-col">
        <TargetSlider
          label="Interested to client"
          value={shareOurs}
          from={shareNow}
          line={shareLine}
          range={{ min: 0, max: 0.5, step: 0.01 }}
          lowerIsBetter={false}
          format={(value) => rateText("closeRate", value)}
          card={false}
        />
      </td>
      <td>
        <TargetStatus {...statusOf(shareOurs, shareLine, true)} />
      </td>
      <td className="tgt-month" />
      <td className="tgt-bar-col">
        <span className={shareMoved ? "sb-per-client is-whatif" : "sb-per-client"}>
          1 client for every{" "}
          {shareMoved && perClient(shareNow) !== perClient(shareOurs) ? (
            <>
              <span className="tgt-was">{perClient(shareNow)}</span>
              <span className="tgt-was__arrow" aria-hidden="true">
                →
              </span>
            </>
          ) : null}
          <strong>{perClient(shareOurs)}</strong> interested
        </span>
      </td>
    </tr>
  );

  const weeksNow = signEveryWeeks(monthNow.newClients);
  const weeksOurs = signEveryWeeks(monthOurs.newClients);
  const topNeed = needs.find(({ target }) => target === biggest)?.need;
  const signRow = (
    <tr key="sign">
      <th scope="row">
        <StepName name="A new client every" why="How often a new client starts at these numbers. On the right: how often each £ target needs one." />
      </th>
      <td />
      <td />
      <td />
      <td />
      <td />
      <td />
      <td className="tgt-num tgt-month">
        <TargetTip
          tip={[
            changed ? `Now every ${paceText(weeksNow)}.` : "",
            ...needs.map(({ target, need }) => `${targetLabel(target)} needs one every ${paceText(signEveryWeeks(need.newClients))}.`),
          ]
            .filter(Boolean)
            .join(" ")}
          end
          className={changed ? "tgt-value is-whatif" : "tgt-value"}
        >
          {paceText(weeksOurs)}
        </TargetTip>
      </td>
      <td className="tgt-bar-col">
        <span className="tgt-vrow">
          <span style={{ flex: 1 }} />
          <span className="tgt-vend" title={`${targetLabel(biggest)} needs a new client every ${paceText(signEveryWeeks(topNeed?.newClients ?? 0))}`}>
            {paceText(signEveryWeeks(topNeed?.newClients ?? 0))}
          </span>
        </span>
      </td>
    </tr>
  );

  const byGap = GROUPS.flatMap((group) => group.keys).sort((a, b) => gains[b] - gains[a]);

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
              <TargetTip tip="Now minus target. 55% against a 50% target is +5%." end>
                Diff
              </TargetTip>
            </th>
            <th scope="col" className="tgt-num tgt-tight">
              <TargetTip tip="What hitting that one target adds to your income a month, with everything else as it is now." end>
                If hit
              </TargetTip>
            </th>
            <th scope="col" className="tgt-bar-col">
              <span className="dash-sr">Now against target</span>
            </th>
            <th scope="col">
              <TargetTip tip="On target, Close (within 20% short of it) or Off target.">Status</TargetTip>
            </th>
            <th scope="col" className="tgt-num tgt-month">
              A month
            </th>
            <th scope="col" className="tgt-bar-col sb-month-bar">
              <span className="tgt-vhead">
                {picked.map((target) => (
                  <span
                    key={target}
                    className={target === biggest ? "tgt-vhead__label is-end" : "tgt-vhead__label"}
                    style={target === biggest ? undefined : { left: `calc((100% - 3.2em - 10px) * ${target / biggest})` }}
                  >
                    {targetLabel(target)}
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
              {group.keys.map(rateRow)}
              {group.label === "Calls" ? shareRow : null}
              {group.label === "Leads" ? extra.map(extraRow) : null}
              {group.label === "Leads" ? addRow : null}
              {group.label === "Leads" ? interestedRow : null}
            </tbody>
          ))
        ) : (
          <tbody>
            {groupRow("Biggest gap first")}
            {byGap.map(rateRow)}
          </tbody>
        )}
        <tbody className="tgt-result">
          {groupRow("What it comes to")}
          <tr>
            <th scope="row">
              <StepName
                name="Clients at once"
                why={`How many clients you have at the same time, once new ones keep coming at this pace: new clients a month × months they stay. It stops at ${MAX_CLIENTS}, about the most one person can coach.`}
              />
            </th>
            <td />
            <td />
            <td />
            <td />
            <td />
            <td />
            {monthCell("clients", amount, "Clients at once", { note: `${amount(monthOurs.newClients)} new a month × ${Math.round(ours.months)} months.` })}
          </tr>
          <tr>
            <th scope="row">
              <StepName name="Income a month" why={`Clients at once × fee a month. Your targets are income a month.`} />
            </th>
            <td />
            <td className="tgt-num tgt-muted tgt-tight">{rateText("fee", ours.fee)}</td>
            <td />
            <td />
            <td />
            <td />
            {monthCell("income", incomeText, "Income a month", { note: `${amount(monthOurs.clients)} clients × ${rateText("fee", ours.fee)}.` })}
          </tr>
          {signRow}
        </tbody>
      </table>
      <p className="pl-foot">It&rsquo;s what&rsquo;s possible on paper, not a forecast.</p>
    </div>
  );
}
