"use client";

import type { ReactNode } from "react";

import { NowInput } from "@/components/profitLevers/targets/ProfitSteps";
import { TargetPath, type Need } from "@/components/profitLevers/targets/TargetPath";
import { TargetSlider } from "@/components/profitLevers/targets/TargetSlider";
import { TargetStatus } from "@/components/profitLevers/targets/TargetStatus";
import { TargetTip } from "@/components/profitLevers/targets/TargetTip";
import { lineStatus, type Status, type TargetLine } from "@/lib/profitTargets";
import {
  CALL_KEYS,
  GREAT,
  RANGES,
  RATES,
  SOURCES,
  amount,
  gainIfHit,
  incomeText,
  interestedToClient,
  needsFor,
  pounds,
  rateText,
  signEveryWeeks,
  targetLabel,
  unitOf,
  volumesOf,
  weeksText,
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
export function ScoreboardSteps({ now, ours, onOurs, targets, picked, order }: Props) {
  const changed = (Object.keys(now) as Array<keyof Numbers>).some((key) => Math.abs(now[key] - ours[key]) > SAME);
  const monthNow = volumesOf(now);
  const monthOurs = volumesOf(ours);
  const needs = picked.map((target) => ({ target, need: needsFor(target, ours) }));
  const needsNow = picked.map((target) => ({ target, need: needsFor(target, now) }));
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
  const gains = Object.fromEntries(RATES.map(({ key }) => [key, gainIfHit(now, key, targets[key])])) as Record<RateKey, number>;

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
          <StepName name={def.label} why={def.why} />
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

  const interestedRow = (
    <tr key="interested">
      <th scope="row">
        <StepName name="Interested" why="Everyone interested in a call a month, outbound and inbound added together." />
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
  const shareGain = volumesOf({ ...now, ...Object.fromEntries(CALL_KEYS.map((key) => [key, targets[key]])) }).income - monthNow.income;
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
            changed ? `Now every ${weeksText(weeksNow)}.` : "",
            ...needs.map(({ target, need }) => `${targetLabel(target)} needs one every ${weeksText(signEveryWeeks(need.newClients))}.`),
          ]
            .filter(Boolean)
            .join(" ")}
          end
          className={changed ? "tgt-value is-whatif" : "tgt-value"}
        >
          {weeksText(weeksOurs)}
        </TargetTip>
      </td>
      <td className="tgt-bar-col">
        <span className="tgt-vrow">
          <span style={{ flex: 1 }} />
          <span className="tgt-vend" title={`${targetLabel(biggest)} needs a new client every ${weeksText(signEveryWeeks(topNeed?.newClients ?? 0))}`}>
            {weeksText(signEveryWeeks(topNeed?.newClients ?? 0))}
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
                why="How many clients you have at the same time, once new ones keep coming at this pace: new clients a month × months they stay."
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
