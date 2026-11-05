import type { BoardColumnId } from "@/lib/practiceKnowledge/blueprintBoard";
import type { PageStatusId } from "@/lib/practiceKnowledge/pageStatus";

/**
 * A page's status as one circle (4 Nov), like Linear's: dotted while it
 * needs the coach (nothing can start), an empty ring while BCA hasn't
 * started, then half and three quarters filled as it moves along, and a
 * tick once done. One colour per
 * step, so the circle and its label always match.
 */
type Look = { fill: number; color: string; dotted?: boolean };

export const STAGE_LOOK: Record<BoardColumnId, Look> = {
  needs_coach: { fill: 0, color: "text-rose-500", dotted: true },
  bca_todo: { fill: 0, color: "text-slate-400" },
  in_progress: { fill: 0.5, color: "text-[#1a8fd4]" },
  coach_review: { fill: 0.75, color: "text-amber-500" },
  done: { fill: 1, color: "text-emerald-500" },
};

/** The coach's five match BCA's, word for word apart from Needs you. */
export const COACH_LOOK: Record<PageStatusId, Look> = {
  needs_you: STAGE_LOOK.needs_coach,
  bca: STAGE_LOOK.bca_todo,
  in_progress: STAGE_LOOK.in_progress,
  review: STAGE_LOOK.coach_review,
  done: STAGE_LOOK.done,
};

function pie(fill: number): string {
  const angle = fill * 2 * Math.PI;
  const x = 7 + 3.5 * Math.sin(angle);
  const y = 7 - 3.5 * Math.cos(angle);
  return `M7 7 L7 3.5 A3.5 3.5 0 ${fill > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

export function StageCircle({ look, label, className = "h-3.5 w-3.5" }: { look: Look; label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={`shrink-0 ${look.color} ${className}`}
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label ? <title>{label}</title> : null}
      {look.dotted ? (
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.4 2.1" strokeLinecap="round" />
      ) : look.fill === 0 ? (
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      ) : look.fill >= 1 ? (
        <>
          <circle cx="7" cy="7" r="7" fill="currentColor" />
          <path d="M4.2 7.2 6.1 9 9.8 5.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d={pie(look.fill)} fill="currentColor" />
        </>
      )}
    </svg>
  );
}
