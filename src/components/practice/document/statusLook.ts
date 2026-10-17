import { CheckCircle2, Circle, Hourglass } from "lucide-react";

import type { SectionWorkflow } from "@/lib/practiceKnowledge/sectionWorkflow";

export type StatusId = SectionWorkflow["status"];

export const STATUS_LABEL: Record<StatusId, string> = { todo: "To do", review: "Review", done: "Done" };

/** Red, amber, green, in the same soft pills as support ticket statuses. */
export const STATUS_LOOK: Record<StatusId, { pill: string; option: string; Icon: typeof Circle; stroke: number }> = {
  todo: { pill: "bg-rose-200 text-rose-900 ring-rose-300", option: "text-rose-800", Icon: Circle, stroke: 2 },
  review: { pill: "bg-amber-200 text-amber-950 ring-amber-300", option: "text-amber-900", Icon: Hourglass, stroke: 1.75 },
  done: { pill: "bg-emerald-200 text-emerald-900 ring-emerald-300", option: "text-emerald-800", Icon: CheckCircle2, stroke: 1.75 },
};
