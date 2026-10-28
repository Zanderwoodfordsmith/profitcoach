import type { Proposal, ProposalStatus } from "@/lib/proposals/types";
import { badgeClass, type BadgeTone } from "@/components/ui/Badge";

const TONE: Record<ProposalStatus, BadgeTone> = {
  draft: "grey",
  sent: "blue",
  opened: "amber",
  signed: "green",
  archived: "grey",
};

const LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  opened: "Opened",
  signed: "Signed",
  archived: "Archived",
};

export function ProposalStatusPill({ status }: { status: ProposalStatus }) {
  return <span className={badgeClass(TONE[status], "shrink-0")}>{LABEL[status]}</span>;
}

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return `today, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** One line on where the proposal stands, newest event first. */
export function proposalActivity(p: Pick<Proposal, "status" | "sent_at" | "last_opened_at" | "open_count" | "signed_at" | "signed_name" | "updated_at">): string {
  if (p.signed_at) return `Signed by ${p.signed_name ?? "them"} ${when(p.signed_at)}`;
  if (p.last_opened_at) return `Opened ${p.open_count} ${p.open_count === 1 ? "time" : "times"}, last ${when(p.last_opened_at)}`;
  if (p.sent_at) return `Sent ${when(p.sent_at)}, not opened yet`;
  return `Edited ${when(p.updated_at)}`;
}
