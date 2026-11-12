"use client";

import "./blueprintTimeline.css";

import Link from "next/link";
import { DateTime } from "luxon";
import { Check, ChevronDown, Flag, Handshake, Phone, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { GetAppModal } from "@/components/install/GetAppModal";
import { buttonClass } from "@/components/ui/Button";

import { useSetupSteps, WaitingForYou, type SetupStep } from "./BlueprintChecklist";
import { usePractice } from "./PracticeProvider";

type Lane = "you" | "bca";

type Step = {
  kind: "step";
  id: string;
  lane: Lane;
  /** Days after joining. Targets from the launch plan (31 Oct), not results we have measured. */
  day: number;
  end: number;
  title: string;
  line: string;
  minutes?: string;
  done: boolean;
  /** The coach can act on it now. */
  ready: boolean;
  action?: SetupStep["action"];
  look?: SetupStep["look"];
};
type Goal = { kind: "goal"; id: string; day: number; title: string; doneTitle: string; line: string; done: boolean; icon: LucideIcon };
type Phase = { kind: "phase"; id: string; title: string; from: number; to: number };
type Today = { kind: "today"; id: "today" };
type Entry = Step | Goal | Phase | Today;
type DateFor = (day: number) => DateTime;

/** After this day a step belongs to life with a client, so it has no date of its own. */
const FIRST_CLIENT_DAY = 90;

const PHASES: Phase[] = [
  { kind: "phase", id: "launch", title: "Launch", from: 0, to: 14 },
  { kind: "phase", id: "calls", title: "Get calls", from: 14, to: 30 },
  { kind: "phase", id: "clients", title: "Get clients", from: 30, to: FIRST_CLIENT_DAY },
  { kind: "phase", id: "keep", title: "Keep clients", from: FIRST_CLIENT_DAY, to: 110 },
];

/**
 * Where a day sits across the width. The first two weeks get nearly half, because
 * that's where the detail is; the months after that are squeezed. Each goal lands
 * on the line between two phases.
 */
const SCALE: [day: number, percent: number][] = [
  [0, 0],
  [14, 48],
  [30, 66],
  [FIRST_CLIENT_DAY, 90],
  [110, 100],
];
function xFor(day: number): number {
  const clamped = Math.min(Math.max(day, 0), 110);
  for (let i = 1; i < SCALE.length; i++) {
    const [d0, x0] = SCALE[i - 1];
    const [d1, x1] = SCALE[i];
    if (clamped <= d1) return x0 + ((clamped - d0) / (d1 - d0)) * (x1 - x0);
  }
  return 100;
}

/** The path from joining to keeping clients, with the checklist's live ticks. */
function usePlan() {
  const setup = useSetupSteps();
  if (!setup) return null;
  const { steps, facts, campaignStatus, asked } = setup;

  const you = (id: string, day: number, end: number, minutes?: string): Step => {
    const step = steps.find((s) => s.id === id);
    if (!step) throw new Error(`No setup step ${id}`);
    return {
      kind: "step",
      id,
      lane: "you",
      day,
      end,
      minutes,
      title: step.title,
      line: step.line,
      done: step.state === "done",
      ready: step.state === "todo",
      action: step.action,
      look: step.look,
    };
  };
  const later = (id: string, lane: Lane, day: number, end: number, title: string, line: string, minutes?: string): Step => ({
    kind: "step",
    id,
    lane,
    day,
    end,
    title,
    line,
    minutes,
    done: false,
    ready: false,
  });
  const ours = (id: string, day: number, end: number, title: string, line: string, done: boolean): Step => ({
    ...later(id, "bca", day, end, title, line),
    done,
  });

  const campaignWritten = campaignStatus === "review" || campaignStatus === "done";

  const entries: (Step | Goal)[] = [
    you("linkedin", 0, 1, "2 min"),
    you("about", 0, 2, "30 min"),
    you("email", 1, 3, "2 min"),
    you("call", 2, 3),
    ours("write-profile", 3, 6, "We write your LinkedIn profile", "Your headline, About section and banner.", Boolean(facts?.linkedin_draft_at)),
    ours("build-list", 3, 6, "We build your list", "The 1,000 owners your campaign goes to.", Boolean(facts?.prospects)),
    ours("write-campaign", 4, 7, "We write your first campaign", "Your connection note and follow-ups, in your voice.", campaignWritten),
    you("prospects", 7, 8),
    you("campaign", 7, 9, "15 min"),
    ours("changes", 8, 10, "We make your changes", "Within one working day.", campaignStatus === "done"),
    you("profile", 9, 10, "10 min"),
    you("app", 9, 11, "2 min"),
    you("alerts", 10, 11, "2 min"),
    { kind: "goal", id: "live", day: 14, title: "You go live", doneTitle: "You're live", line: "We switch your campaign on.", done: Boolean(facts?.campaign_live), icon: Flag },

    later("replies", "you", 15, 60, "Reply to prospects", "Ava tells you when someone replies and drafts your answer."),
    later("content", "bca", 15, 19, "We write your posts and newsletter", "So people who see your name know what you do."),
    later("reactivation", "bca", 16, 20, "We write to people you already know", "Three short messages. They restart the chat, with no pitch."),
    later("check-content", "you", 19, 22, "Check your posts and messages", "Tell us anything that doesn't sound like you.", "10 min"),
    later("practise", "you", 22, 26, "Practise a call", "Run one before your first real call.", "15 min"),
    { kind: "goal", id: "first-call", day: 30, title: "Your first call", doneTitle: "Your first call", line: "Our target for every coach.", done: false, icon: Phone },

    later("sales-calls", "you", 30, FIRST_CLIENT_DAY, "Run your sales calls", "Your offer, your pitch and how to run each call."),
    later("review", "bca", 31, 36, "We check your results", "No call yet? We go through your list and messages with you."),
    later("next-list", "bca", 40, 50, "We plan your next list", "So your campaign keeps going when the first list runs out."),
    { kind: "goal", id: "first-client", day: FIRST_CLIENT_DAY, title: "Your first client", doneTitle: "Your first client", line: "Our target for every coach.", done: false, icon: Handshake },

    later("welcome", "you", FIRST_CLIENT_DAY, 98, "Welcome your client", "The agreement, the welcome pack and the first session."),
    later("sessions", "you", 92, 110, "Run sessions 1 to 4", "Your first four to six weeks together."),
  ];

  return { entries, loading: !asked, setup };
}

/** Weekend targets move to Monday. */
function weekday(date: DateTime): DateTime {
  return date.weekday > 5 ? date.plus({ days: 8 - date.weekday }) : date;
}

/**
 * Days count from joining. A coach running behind sees later dates, never an
 * overdue one: the first open step lands on today and the rest follow it.
 */
function startDate(entries: (Step | Goal)[], joinedAt: string | null): DateTime {
  const today = DateTime.now().startOf("day");
  const joined = joinedAt ? DateTime.fromISO(joinedAt).startOf("day") : today;
  const firstOpenDay = entries.find((e) => !e.done)?.day ?? 0;
  const latest = today.minus({ days: firstOpenDay });
  return joined > latest ? joined : latest;
}

const short = (date: DateTime) => date.toFormat("ccc d LLL");

function whenLabel(step: Step, dateFor: DateFor): string | null {
  if (step.done) return "Done";
  if (step.day >= FIRST_CLIENT_DAY) return null;
  const date = dateFor(step.day);
  // Close dates are exact; further out, the week is as much as anyone can say.
  const when = step.day > 14 ? `Week of ${date.startOf("week").toFormat("d LLL")}` : short(date);
  return step.minutes ? `${when} · ${step.minutes}` : when;
}

const vars = (values: Record<string, number | string>) => values as unknown as CSSProperties;

/**
 * The Overview as a timeline (Zander, 6 Nov): a cascade across dated phases with
 * today marked, so a coach sees what's next and what's after that. One column on
 * phones and beside a docked chat. Sits beside the checklist behind the admin
 * switch until he picks.
 */
export function BlueprintTimeline() {
  const { coachJoinedAt } = usePractice();
  const plan = usePlan();
  if (!plan) return null;
  if (plan.loading) return <div className="mt-8 min-h-[32rem]" aria-busy="true" />;

  const { entries, setup } = plan;
  const start = startDate(entries, coachJoinedAt);
  const dateFor: DateFor = (day) => weekday(start.plus({ days: day }));
  const todayDay = DateTime.now().startOf("day").diff(start, "days").days;

  const nextYou = entries.find((e): e is Step => e.kind === "step" && e.lane === "you" && e.ready && !e.done) ?? null;
  const nextBca = entries.find((e): e is Step => e.kind === "step" && e.lane === "bca" && !e.done) ?? null;
  const live = entries.find((e): e is Goal => e.kind === "goal" && e.id === "live");

  const shared = { dateFor, nextYouId: nextYou?.id ?? null, nextBcaId: nextBca?.id ?? null };

  return (
    <section aria-labelledby="bt-heading" className="mt-8">
      <WaitingForYou />

      <div className="bt-frame">
        <header className="bt-header">
          <div className="min-w-0">
            <h2 id="bt-heading" className="text-heading font-light text-slate-900">
              {live?.done ? (
                <span className="font-semibold">You&apos;re live</span>
              ) : (
                <>
                  You go live by <span className="font-semibold">{live ? short(dateFor(live.day)) : ""}</span>
                </>
              )}
            </h2>
            <p className="mt-2 text-read text-slate-600">
              {nextYou ? (
                <>
                  Next from you: <span className="font-medium text-slate-900">{nextYou.title}</span>
                  {nextYou.minutes ? `, ${nextYou.minutes}.` : "."}
                </>
              ) : nextBca ? (
                <>
                  Nothing needed from you right now. Next from BCA:{" "}
                  <span className="font-medium text-slate-900">{nextBca.title}</span>.
                </>
              ) : (
                "Everything on your path is done."
              )}
            </p>
          </div>
          <ul className="bt-legend text-caption" aria-label="Key">
            <li>
              <span className="bt-swatch bt-swatch-you" aria-hidden /> You
            </li>
            <li>
              <span className="bt-swatch bt-swatch-bca" aria-hidden /> BCA
            </li>
            <li>
              <span className="bt-swatch bt-swatch-done" aria-hidden /> Done
            </li>
          </ul>
        </header>

        <Cascade entries={entries} todayDay={todayDay} {...shared} />
        <Column entries={entries} {...shared} />
      </div>
      <GetAppModal open={setup.getApp} onClose={() => setup.setGetApp(false)} />
    </section>
  );
}

type Shared = { dateFor: DateFor; nextYouId: string | null; nextBcaId: string | null };

/* ---- The cascade: wide screens ---- */

function phaseDates(phase: Phase, dateFor: DateFor): string {
  if (phase.from >= FIRST_CLIENT_DAY) return "After your first client";
  return `${dateFor(phase.from).toFormat("d LLL")} to ${dateFor(phase.to).toFormat("d LLL")}`;
}

function Cascade({ entries, todayDay, dateFor, nextYouId, nextBcaId }: Shared & { entries: (Step | Goal)[]; todayDay: number }) {
  const todayX = xFor(todayDay);
  return (
    <div className="bc" style={vars({ "--today": todayX })}>
      <div className="bc-axis">
        <div className="bc-phases">
          {PHASES.map((phase) => (
            <div key={phase.id} className="bc-phase" style={vars({ "--w": xFor(phase.to) - xFor(phase.from) })}>
              <h3 className="text-ui font-semibold text-slate-900">{phase.title}</h3>
              <p className="text-caption text-slate-500">{phaseDates(phase, dateFor)}</p>
            </div>
          ))}
        </div>
        <div className="bc-track" aria-hidden>
          <span className="bc-track-ahead" />
          {PHASES.slice(0, -1).map((phase) => (
            <span key={phase.id} className="bc-track-tick" style={vars({ "--x": xFor(phase.to) })} />
          ))}
        </div>
        <p className="bc-today-pill">
          <span className="bc-today-dot" aria-hidden />
          Today, {short(DateTime.now())}
        </p>
      </div>

      <div className="bc-body">
        <span className="bc-today-line" aria-hidden />
        {PHASES.slice(0, -1).map((phase) => (
          <span key={phase.id} className="bc-divider" style={vars({ "--x": xFor(phase.to) })} aria-hidden />
        ))}
        <ol className="bc-rows">
          {entries.map((entry, index) =>
            entry.kind === "goal" ? (
              <CascadeGoal key={entry.id} goal={entry} index={index} dateFor={dateFor} />
            ) : (
              <CascadeRow
                key={entry.id}
                step={entry}
                index={index}
                dateFor={dateFor}
                next={entry.id === nextYouId}
                nextFromBca={entry.id === nextBcaId}
              />
            ),
          )}
        </ol>
      </div>
    </div>
  );
}

function CascadeGoal({ goal, index, dateFor }: { goal: Goal; index: number; dateFor: DateFor }) {
  const Icon = goal.done ? Check : goal.icon;
  return (
    <li className={`bc-goal${goal.done ? " is-done" : ""}`} style={vars({ "--x": xFor(goal.day), "--i": index })}>
      <span className="bc-goal-pill">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-semibold">{goal.done ? goal.doneTitle : goal.title}</span>
        <span className="bc-goal-date tabular-nums">{goal.done ? "Done" : `by ${short(dateFor(goal.day))}`}</span>
      </span>
      {goal.done ? null : <span className="bc-goal-line text-caption">{goal.line}</span>}
    </li>
  );
}

function CascadeRow({
  step,
  index,
  dateFor,
  next,
  nextFromBca,
}: {
  step: Step;
  index: number;
  dateFor: DateFor;
  next: boolean;
  nextFromBca: boolean;
}) {
  const [open, setOpen] = useState(false);
  const x = xFor(step.day);
  const end = xFor(step.end);
  // After launch the bars run into the narrower columns, so the words sit on their left.
  const flip = step.day >= 14;
  const when = whenLabel(step, dateFor);
  const state = step.done ? "is-done" : next ? "is-next" : step.ready ? "is-ready" : "is-ahead";
  return (
    <li
      className={`bc-row bc-${step.lane} ${state}${flip ? " is-flip" : ""}${nextFromBca ? " is-next-bca" : ""}`}
      style={vars({ "--x": x, "--e": end, "--i": index })}
    >
      <span className="bc-bar" aria-hidden>
        {step.done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : null}
      </span>
      <div className="bc-label">
        <div className="bc-head">
          <button type="button" className="bc-title text-ui" aria-expanded={open} onClick={() => setOpen((was) => !was)}>
            {step.title}
            {step.done ? <span className="sr-only"> (done)</span> : null}
            <ChevronDown className={`bc-chevron h-3.5 w-3.5 ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {when ? <span className="bc-when text-caption tabular-nums">{when}</span> : null}
          {nextFromBca ? <span className="bc-up-next text-caption">Next from BCA</span> : null}
          {!step.done && step.look && (next || open) ? (
            <Link href={step.look.href} className={buttonClass("quiet", "small", "!h-7 !px-2")}>
              {step.look.label}
            </Link>
          ) : null}
          {!step.done && step.action ? <StepAction action={step.action} next={next} compact /> : null}
        </div>
        {open ? <p className="bc-line text-ui">{step.line}</p> : null}
      </div>
    </li>
  );
}

/* ---- One column: phones, and beside a docked chat ---- */

function Column({ entries, dateFor, nextYouId, nextBcaId }: Shared & { entries: (Step | Goal)[] }) {
  const firstOpen = entries.findIndex((e) => !e.done);
  const list: Entry[] = [];
  entries.forEach((entry, index) => {
    const opening = PHASES.find((p) => entry.day >= p.from && (entry.day < p.to || p.id === "keep"));
    if (entry.kind === "step" && opening && !list.includes(opening)) list.push(opening);
    if (index === firstOpen) list.push({ kind: "today", id: "today" });
    list.push(entry);
  });

  const count = list.length + 1;
  const today = list.findIndex((e) => e.kind === "today") + 1 || count;

  return (
    <ol className="bt-grid">
      <li aria-hidden className="bt-spine bt-spine-past" style={vars({ "--n-from": 1, "--n-to": today })} />
      <li aria-hidden className="bt-spine bt-spine-ahead" style={vars({ "--n-from": today, "--n-to": count })} />
      {list.map((entry, index) => {
        const style = vars({ "--n": index + 1, "--i": Math.min(index, 14) });
        if (entry.kind === "phase") {
          return (
            <li key={entry.id} className="bt-phase" style={style}>
              <h3 className="text-subhead font-semibold text-slate-900">{entry.title}</h3>
              <p className="text-caption text-slate-500">{phaseDates(entry, dateFor)}</p>
            </li>
          );
        }
        if (entry.kind === "today") {
          return (
            <li key={entry.id} className="bt-today" style={style}>
              <span className="bc-today-pill !static">
                <span className="bc-today-dot" aria-hidden />
                Today, {short(DateTime.now())}
              </span>
            </li>
          );
        }
        if (entry.kind === "goal") {
          const Icon = entry.done ? Check : entry.icon;
          return (
            <li key={entry.id} className={`bt-goal${entry.done ? " is-done" : ""}`} style={style}>
              <span className="bc-goal-pill">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="font-semibold">{entry.done ? entry.doneTitle : entry.title}</span>
                <span className="bc-goal-date tabular-nums">{entry.done ? "Done" : `by ${short(dateFor(entry.day))}`}</span>
              </span>
            </li>
          );
        }
        return (
          <ColumnStep key={entry.id} step={entry} next={entry.id === nextYouId} nextFromBca={entry.id === nextBcaId} dateFor={dateFor} style={style} />
        );
      })}
    </ol>
  );
}

function ColumnStep({
  step,
  next,
  nextFromBca,
  dateFor,
  style,
}: {
  step: Step;
  next: boolean;
  nextFromBca: boolean;
  dateFor: DateFor;
  style: CSSProperties;
}) {
  const state = step.done ? "is-done" : next ? "is-next" : step.ready ? "is-ready" : "is-ahead";
  const when = whenLabel(step, dateFor);
  return (
    <li className={`bt-step bt-${step.lane} ${state}`} style={style}>
      <span className="bt-dot" aria-hidden>
        {step.done ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
      </span>
      <div className="bt-card">
        <h3 className="bt-title text-ui">
          {step.title}
          {step.done ? <span className="sr-only"> (done)</span> : null}
        </h3>
        {step.done ? null : <p className="bt-line text-ui">{step.line}</p>}
        <div className="bt-foot">
          <span className="bt-when text-caption tabular-nums">
            {step.lane === "you" ? "You" : "BCA"}
            {when ? ` · ${when}` : ""}
          </span>
          {nextFromBca ? <span className="bc-up-next text-caption">Next from BCA</span> : null}
          {!step.done && (step.look || step.action) ? (
            <span className="bt-actions">
              {step.look ? (
                <Link href={step.look.href} className={buttonClass("quiet", "small", "!px-2")}>
                  {step.look.label}
                </Link>
              ) : null}
              {step.action ? <StepAction action={step.action} next={next} /> : null}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function StepAction({ action, next, compact = false }: { action: NonNullable<SetupStep["action"]>; next: boolean; compact?: boolean }) {
  const cls = buttonClass(next ? "main" : compact ? "quiet" : "second", "small", `disabled:opacity-60${compact ? " !h-7" : ""}${compact && !next ? " !px-2" : ""}`);
  return action.href ? (
    <Link href={action.href} className={cls}>
      {action.label}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} disabled={action.busy} className={cls}>
      {action.busy ? "Saving…" : action.label}
    </button>
  );
}
