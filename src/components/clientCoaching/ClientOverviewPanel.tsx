"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ExternalLink, Linkedin } from "lucide-react";
import { ClientMiniCalendar } from "@/components/clients/ClientMiniCalendar";
import { ClientSessionsList } from "@/components/clients/ClientSessionsList";
import { ProspectActivityFeed } from "@/components/prospects/ProspectActivityFeed";
import type { ClientSessionRow } from "@/lib/clientCoaching/loadClientSessions";
import { clientWorkspacePath } from "@/lib/clientCoaching/defaults";
import type { ClientWorkspaceContact } from "@/lib/clientCoaching/types";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";

type Props = {
  contact: ClientWorkspaceContact;
  contactId: string;
  onViewAsClient: () => void;
  impersonateCoachId?: string | null;
  isAdmin?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export function ClientOverviewPanel({
  contact,
  contactId,
  onViewAsClient,
  impersonateCoachId = null,
  isAdmin = false,
}: Props) {
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [filterDateKey, setFilterDateKey] = useState<string | null>(null);
  const playbooksHref = `/coach/contacts/${encodeURIComponent(contact.id)}/playbooks`;
  const bossHref = bossProHubPath(contact.id);
  const conversationsHref = isAdmin
    ? "/admin/conversations"
    : "/coach/conversations";
  const notesHref = clientWorkspacePath(contactId, "notes", { admin: isAdmin });

  const onSessionsLoaded = useCallback((sessions: ClientSessionRow[]) => {
    setSessionDates(sessions.map((s) => s.startsAt));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            {contact.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contact.photoUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-100"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600">
                {initials(contact.fullName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                Client overview
              </p>
              <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">
                {contact.fullName}
              </h2>
              {contact.headline || contact.jobTitle ? (
                <p className="mt-0.5 text-sm text-slate-500">
                  {contact.headline || contact.jobTitle}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {contact.linkedinUrl ? (
                <a
                  href={contact.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Linkedin className="h-3.5 w-3.5 text-sky-700" aria-hidden />
                  LinkedIn
                </a>
              ) : null}
              <button
                type="button"
                onClick={onViewAsClient}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                View as client
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3 lg:grid-cols-6">
            <InfoCell label="Business" value={contact.businessName ?? ""} />
            <InfoCell label="Title" value={contact.jobTitle ?? ""} />
            <InfoCell label="Email" value={contact.email ?? ""} />
            <InfoCell label="Phone" value={contact.phone ?? ""} />
            <InfoCell label="Location" value={contact.location ?? ""} />
            <InfoCell
              label="Plan"
              value="3-year + 90-day"
            />
          </dl>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Link
              href={bossHref}
              className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
            >
              <p className="text-sm font-semibold text-slate-900">Boss Pro</p>
              <p className="mt-0.5 text-xs text-slate-500">Workshop & scores</p>
            </Link>
            <Link
              href={playbooksHref}
              className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
            >
              <p className="text-sm font-semibold text-slate-900">Playbooks</p>
              <p className="mt-0.5 text-xs text-slate-500">Delivery progress</p>
            </Link>
            <Link
              href={notesHref}
              className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
            >
              <p className="text-sm font-semibold text-slate-900">Session notes</p>
              <p className="mt-0.5 text-xs text-slate-500">Coaching sheet</p>
            </Link>
          </div>
        </section>

        <ClientMiniCalendar
          sessionDates={sessionDates}
          selectedDate={filterDateKey}
          onSelectDate={setFilterDateKey}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <ClientSessionsList
          contactId={contactId}
          impersonateCoachId={impersonateCoachId}
          filterDateKey={filterDateKey}
          compact
          onSessionsLoaded={onSessionsLoaded}
          onOpenNotes={() => {
            window.location.href = notesHref;
          }}
        />
        <div className="max-h-[32rem] overflow-hidden">
          <ProspectActivityFeed
            contactId={contactId}
            conversationsHref={conversationsHref}
            isAdmin={isAdmin}
            impersonateCoachId={impersonateCoachId}
          />
        </div>
      </div>
    </div>
  );
}
