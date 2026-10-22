import type { Proposal, ProposalStatus } from "@/lib/proposals/types";

const STYLE: Record<ProposalStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200",
  opened: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
  signed: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  archived: "bg-slate-100 text-slate-500",
};

const LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  opened: "Opened",
  signed: "Signed",
  archived: "Archived",
};

export function ProposalStatusPill({ status }: { status: ProposalStatus }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>{LABEL[status]}</span>;
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
