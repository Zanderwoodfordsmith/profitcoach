import type { Status } from "@/lib/profitTargets";

type Props = {
  status: Status;
  /** In place of the usual word, e.g. "Over capacity". */
  text?: string;
};

/** Against the one target: on it (or better), within 15% of it, or further off. Same words as the card. */
const TEXT: Record<Status, string> = {
  good: "On target",
  close: "Close",
  below: "Off target",
  none: "Not set",
};

/** The status column: a word and an icon, so colour is never the only signal. */
export function TargetStatus({ status, text }: Props) {
  return (
    <span className={`tgt-status tgt-status--${status}`}>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        {status === "good" ? (
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : status === "none" ? (
          <path d="M3 6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <path d="M6 2.5v4.2M6 9.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
      {text ?? TEXT[status]}
    </span>
  );
}
