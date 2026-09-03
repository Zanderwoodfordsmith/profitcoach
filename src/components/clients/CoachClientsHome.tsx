"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Linkedin,
  Plus,
  Sparkles,
} from "lucide-react";
import type { ClientRosterItem } from "@/components/clients/ClientsRoster";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { clientWorkspacePath } from "@/lib/clientCoaching/defaults";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
import {
  formatProspectNextCallWhen,
  getProspectNextCallName,
  type ProspectNextCall,
} from "@/lib/prospectNextCall";

export type CoachClientHomeItem = ClientRosterItem & {
  next_call?: ProspectNextCall | null;
  boss_score?: number | null;
  boss_score_premium?: number | null;
  last_assessed_at?: string | null;
};

type AttentionItem = {
  id: string;
  contactId: string;
  name: string;
  reason: string;
  href: string;
  actionLabel: string;
};

type Props = {
  clients: CoachClientHomeItem[];
  loading?: boolean;
  onAddClient: () => void;
  onViewAsClient?: (contactId: string) => void;
  admin?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function buildAttention(
  clients: CoachClientHomeItem[],
  admin: boolean
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const c of clients) {
    const hasAnyScore =
      c.boss_score_premium != null ||
      c.boss_score != null ||
      c.last_score != null;

    if (!hasAnyScore) {
      items.push({
        id: `${c.id}-score`,
        contactId: c.id,
        name: c.full_name,
        reason: "No BOSS Score yet",
        href: bossProHubPath(c.id, { admin }),
        actionLabel: "Run BOSS Score",
      });
      continue;
    }

    if (!c.next_call?.start_time) {
      const stale = daysSince(c.last_assessed_at);
      if (stale == null || stale >= 21) {
        items.push({
          id: `${c.id}-session`,
          contactId: c.id,
          name: c.full_name,
          reason:
            stale == null
              ? "No upcoming session"
              : `No upcoming session · last scored ${stale}d ago`,
          href: clientWorkspacePath(c.id, "overview", { admin }),
          actionLabel: "Open client",
        });
      }
    }
  }
  return items.slice(0, 6);
}

const actionRow =
  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-sky-950 transition hover:bg-sky-50";

export function CoachClientsHome({
  clients,
  loading = false,
  onAddClient,
  onViewAsClient,
  admin = false,
}: Props) {
  const upcoming = clients
    .filter((c) => c.next_call?.start_time)
    .map((c) => ({
      client: c,
      start: new Date(c.next_call!.start_time).getTime(),
    }))
    .filter((row) => !Number.isNaN(row.start) && row.start >= Date.now() - 60_000)
    .sort((a, b) => a.start - b.start)
    .slice(0, 8);

  const attention = buildAttention(clients, admin);
  const prefix = admin ? "/admin" : "/coach";

  if (loading) {
    return (
      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
        aria-busy="true"
        aria-label="Loading coaching home"
      >
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
          <div className="h-40 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
        </div>
        <div className="space-y-4">
          <div className="h-56 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
          <div className="h-36 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Upcoming sessions
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Next coaching calls across your roster.
              </p>
            </div>
            <Link
              href={`${prefix}/calls`}
              className="text-sm font-medium text-sky-800 hover:text-sky-950"
            >
              Full calendar
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
              <CalendarClock
                className="mx-auto h-8 w-8 text-slate-400"
                aria-hidden
              />
              <p className="mt-3 text-sm font-medium text-slate-900">
                No upcoming sessions
              </p>
              <p className="mt-1 text-sm text-slate-600">
                When a client books a call, it shows up here. Open someone to log
                a session manually.
              </p>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-slate-100">
              {upcoming.map(({ client }) => {
                const when = formatProspectNextCallWhen(client.next_call);
                const title = getProspectNextCallName(client.next_call);
                const href = clientWorkspacePath(client.id, "overview", {
                  admin,
                });
                return (
                  <li key={client.id}>
                    <Link
                      href={href}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-sky-50/70"
                    >
                      {client.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={client.photo_url}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                          {initials(client.full_name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {client.full_name}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-slate-600">
                          {title}
                          {when ? ` · ${when}` : null}
                        </p>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)] sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Needs attention
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Gaps that usually mean a client is waiting on you.
          </p>

          {attention.length === 0 ? (
            <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              Roster looks current — scores and sessions are in good shape.
            </p>
          ) : (
            <ul className="mt-5 space-y-2">
              {attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="truncate text-sm text-slate-700">
                        {item.reason}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-sky-900">
                      {item.actionLabel} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Clients
              <span className="ml-1.5 font-normal text-slate-600">
                ({clients.length})
              </span>
            </h2>
            <button
              type="button"
              onClick={onAddClient}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </button>
          </div>

          <ul className="mt-3 max-h-[22rem] space-y-0.5 overflow-y-auto">
            {clients.map((client) => {
              const href = clientWorkspacePath(client.id, "overview", {
                admin,
              });
              return (
                <li key={client.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-sky-50"
                  >
                    {client.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={client.photo_url}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                        {initials(client.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {client.full_name}
                      </p>
                      <p className="truncate text-xs text-slate-600">
                        {client.business_name ||
                          client.job_title ||
                          client.headline ||
                          "Client"}
                      </p>
                    </div>
                    {client.linkedin_url ? (
                      <span
                        className="shrink-0 text-sky-800"
                        title="Has LinkedIn"
                      >
                        <LinkedInSolidIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          {onViewAsClient ? (
            <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
              Open a client for notes, plans, and “view as”.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)]">
          <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
          <ul className="mt-3 space-y-1.5">
            <li>
              <button type="button" onClick={onAddClient} className={actionRow}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-900">
                  <Linkedin className="h-4 w-4" aria-hidden />
                </span>
                Import from LinkedIn
              </button>
            </li>
            <li>
              <Link
                href={bossProHubPath(null, { admin })}
                className={actionRow}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-900">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                Start BOSS Score
              </Link>
            </li>
            <li>
              <Link href={`${prefix}/playbooks`} className={actionRow}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-900">
                  <BookOpen className="h-4 w-4" aria-hidden />
                </span>
                Open playbooks
              </Link>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
