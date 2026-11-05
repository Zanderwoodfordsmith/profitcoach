import { Check } from "lucide-react";

/**
 * The "Seen" tick under a message (5 Nov): a one-tap "got it" in place of a
 * reply. On the newest message from the other side it always shows, so people
 * find it and can tap it on a phone; on older ones it shows on hover. Once
 * ticked it says who saw it; the one who ticked can tap again to untick.
 *
 * `inline` (5 Nov): small text in the message's name line, after the time,
 * so it takes no row of its own. Hidden ones keep their width, so nothing
 * moves when they show on hover.
 */
export function SeenTick({
  seenAt,
  seenName,
  canTick,
  latest,
  onTick,
  inline = false,
}: {
  seenAt: string | null;
  /** Who ticked it: a first name, or "you". */
  seenName: string | null;
  /** This viewer is on the other side, so the tick is theirs to give. */
  canTick: boolean;
  latest: boolean;
  onTick: (seen: boolean) => void;
  inline?: boolean;
}) {
  if (seenAt) {
    const label = seenName === "you" ? "Seen" : seenName ? `Seen by ${seenName}` : "Seen";
    const className = inline
      ? "inline-flex shrink-0 items-center gap-0.5 self-center rounded px-1 text-xs font-medium text-emerald-700"
      : "-ml-1.5 mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-emerald-700";
    return canTick ? (
      <button type="button" onClick={() => onTick(false)} title="Untick" className={`${className} hover:bg-emerald-50`}>
        <Check className={inline ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.25} aria-hidden />
        {label}
      </button>
    ) : (
      <p className={className}>
        <Check className={inline ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.25} aria-hidden />
        {label}
      </p>
    );
  }
  if (!canTick) return null;
  if (inline) {
    return (
      <button
        type="button"
        onClick={() => onTick(true)}
        title="Tick to say you've seen it, no reply needed"
        className={`inline-flex shrink-0 items-center gap-0.5 self-center rounded px-1 text-xs font-medium text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:opacity-100 ${
          latest ? "" : "opacity-0 group-hover/msg:opacity-100"
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        Seen
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onTick(true)}
      title="Tick to say you've seen it, no reply needed"
      className={`mt-1 inline-flex items-center gap-1 rounded-md border border-[#d5dee8] bg-white px-2 py-0.5 text-xs font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 ${
        latest ? "" : "opacity-0 focus-visible:opacity-100 group-hover/msg:opacity-100"
      }`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      Seen
    </button>
  );
}
