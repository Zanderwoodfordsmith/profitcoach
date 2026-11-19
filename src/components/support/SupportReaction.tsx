"use client";

import { useState } from "react";
import { Plus, ThumbsUp } from "lucide-react";
import { SUPPORT_REACTIONS, DEFAULT_SUPPORT_REACTION, shownReaction } from "@/lib/support/reactions";

/**
 * A reaction under a Support message (19 Nov), in place of the "Seen" tick:
 * "got it, no reply needed", without sending another message. One tap is 👍
 * (the community's thumbs up); + opens ❤️ 🙏 😂 ✅ 🔥 💪. On the newest message from
 * the other side it always shows, so people find it on a phone; on older ones
 * it shows on hover. Once given, it shows the emoji and who gave it; the one
 * who gave it can tap it to change or remove it.
 *
 * `inline`: sits in the message's name line, after the time, taking no row of
 * its own. Hidden ones keep their width, so nothing moves on hover.
 */
export function SupportReaction({
  reactedAt,
  reaction,
  reactedName,
  canReact,
  latest,
  onReact,
  inline = false,
}: {
  /** When the other side reacted (the old "Seen" time); null = not yet. */
  reactedAt: string | null;
  /** Which emoji; null on an old "Seen" tick, shown as 👍. */
  reaction: string | null;
  /** Who reacted: a first name, or "you". */
  reactedName: string | null;
  /** This viewer is on the other side, so the reaction is theirs to give. */
  canReact: boolean;
  latest: boolean;
  /** An emoji to react with, or null to take the reaction off. */
  onReact: (reaction: string | null) => void;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const place = inline ? "self-center" : "-ml-1 mt-1";

  function pick(emoji: string) {
    setOpen(false);
    onReact(reactedAt && shownReaction(reaction) === emoji ? null : emoji);
  }

  // Closes when focus leaves the choices (a tap anywhere else).
  const closeOnBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
  };

  if (open && canReact) {
    const current = reactedAt ? shownReaction(reaction) : null;
    return (
      <span
        role="group"
        aria-label="React"
        onBlur={closeOnBlur}
        className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#d5dee8] bg-white px-1 py-0.5 shadow-sm ${place}`}
      >
        {SUPPORT_REACTIONS.map((emoji, i) => (
          <button
            key={emoji}
            type="button"
            autoFocus={i === 0}
            onClick={() => pick(emoji)}
            title={current === emoji ? "Take it off" : `React ${emoji}`}
            className={`rounded-full px-1 text-sm leading-5 hover:bg-slate-100 ${current === emoji ? "bg-sky-100" : ""}`}
          >
            {emoji}
          </button>
        ))}
      </span>
    );
  }

  if (reactedAt) {
    const emoji = shownReaction(reaction);
    const who = reactedName === "you" ? "You" : reactedName;
    const chip = `inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1.5 text-xs font-medium leading-5 text-[#0c5290] ${place}`;
    const label = (
      <>
        <span className="text-sm leading-5">{emoji}</span>
        {who ? <span>{who}</span> : null}
      </>
    );
    return canReact ? (
      <button type="button" onClick={() => setOpen(true)} title="Change or take it off" className={`${chip} hover:bg-sky-100`}>
        {label}
      </button>
    ) : (
      <span className={chip} title={who ? `${who} reacted ${emoji}` : `Reacted ${emoji}`}>
        {label}
      </span>
    );
  }

  if (!canReact) return null;
  const shown = latest ? "" : "opacity-0 focus-within:opacity-100 group-hover/msg:opacity-100";
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 ${place} ${shown}`}>
      <button
        type="button"
        onClick={() => onReact(DEFAULT_SUPPORT_REACTION)}
        title="React 👍: got it, no reply needed"
        aria-label="React thumbs up"
        className="inline-flex items-center rounded-md p-1 text-slate-500 hover:bg-sky-50 hover:text-sky-700"
      >
        <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="More reactions"
        aria-label="More reactions"
        className="inline-flex items-center rounded-md p-1 text-slate-400 hover:bg-sky-50 hover:text-sky-700"
      >
        <Plus className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      </button>
    </span>
  );
}
