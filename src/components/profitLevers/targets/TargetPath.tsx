"use client";

import { TargetTip } from "./TargetTip";

/** One £ profit target and what it needs of this row. */
export type Need = { label: string; target: number; value: number };

type Props = {
  /** A year at the dots' numbers: where they are, or a what-if. */
  value: number | null;
  /** Where they are now. */
  actual: number | null;
  /** A dot or the leads bar has moved, so `value` is a what-if. */
  moved: boolean;
  /** What each £ target needs a year, smallest target first. */
  needs: Need[];
  format: (value: number) => string;
  /** Said on hover after the counts. */
  note?: string;
  /** Leads only: the bar can be dragged to try another number. */
  onChange?: (value: number) => void;
  step?: number;
  label: string;
  /** What the number is per, in the hover text: a year, or a month on the public page. */
  per?: string;
  /** What the biggest target needed at their numbers now. During a what-if, shown greyed before the new need. */
  topWas?: number;
};

/** The biggest target is the right-hand end of every bar; a smaller one sits at its share of it. */
export function volumeTickAt(target: number, biggest: number): string {
  return `${Math.min(target / biggest, 1) * 100}%`;
}

/**
 * The year half of a row (copied from the BCA Targets tab's TargetPath): the number, then a navy bar of it that is
 * full at the biggest target, with that target's need written after the bar. A smaller target is a tick inside the
 * bar (its number on hover).
 */
export function TargetPath({ value, actual, moved, needs, format, note, onChange, step = 1, label, per = "a year", topWas }: Props) {
  const biggest = Math.max(...needs.map(({ target }) => target));
  const topNeed = needs.find(({ target }) => target === biggest);
  const top = topNeed?.value ?? 0;
  const tip = [moved && actual !== null ? `Now ${format(actual)} ${per}.` : "", note].filter(Boolean).join(" ");
  const fill = value !== null && top > 0 ? Math.min(value / top, 1) : 0;
  // During a what-if, each number shows where it was first: "240 → 264". Only when the shown number changed.
  const differs = (was: number | null | undefined, now: number | null) =>
    moved && was !== null && was !== undefined && now !== null && format(was) !== format(now);
  const was = (before: number) => (
    <>
      <span className="tgt-was">{format(before)}</span>
      <span className="tgt-was__arrow" aria-hidden="true">
        →
      </span>
    </>
  );

  return (
    <>
      <td className="tgt-num tgt-month">
        <TargetTip tip={tip} end className={moved ? "tgt-value is-whatif" : "tgt-value"}>
          {differs(actual, value) && actual !== null ? was(actual) : null}
          {value !== null ? format(value) : "—"}
        </TargetTip>
      </td>
      <td className="tgt-bar-col">
        <span className="tgt-vrow">
          <span className={onChange ? "tgt-vbar is-input" : "tgt-vbar"}>
            {value !== null ? <span className="tgt-vbar__fill" style={{ width: `${fill * 100}%` }} /> : null}
            {needs
              .filter(({ target }) => target !== biggest)
              .map(({ label: name, target, value: need }) => (
                <span
                  key={name}
                  className="tgt-vbar__tick"
                  style={{ left: volumeTickAt(target, biggest) }}
                  title={`${name} needs ${format(need)}`}
                  aria-hidden="true"
                />
              ))}
            {onChange && top > 0 ? (
              <input
                type="range"
                min={0}
                max={Math.round(top)}
                step={step}
                value={Math.min(Math.round(value ?? 0), Math.round(top))}
                onChange={(event) => onChange(Number(event.target.value))}
                aria-label={`${label} ${per}: try another number`}
                aria-valuetext={value !== null ? format(value) : undefined}
              />
            ) : null}
          </span>
          <span className="tgt-vend" title={topNeed ? `${topNeed.label} needs ${format(top)}` : undefined}>
            {differs(topWas, top) && topWas !== undefined ? was(topWas) : null}
            {format(top)}
          </span>
        </span>
        <span className="dash-sr">{needs.map(({ label: name, value: need }) => `${name} needs ${format(need)}.`).join(" ")}</span>
      </td>
    </>
  );
}
