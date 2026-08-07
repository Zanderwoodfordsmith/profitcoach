"use client";

import Link from "next/link";
import type { ClientWorkspaceContact } from "@/lib/clientCoaching/types";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";

type Props = {
  contact: ClientWorkspaceContact;
  onViewAsClient: () => void;
};

export function ClientOverviewPanel({ contact, onViewAsClient }: Props) {
  const playbooksHref = `/coach/contacts/${encodeURIComponent(contact.id)}/playbooks`;
  const bossHref = bossProHubPath(contact.id);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
          Client
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {contact.fullName}
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Business
            </dt>
            <dd className="mt-0.5 text-sm text-slate-800">
              {contact.businessName?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Email
            </dt>
            <dd className="mt-0.5 text-sm text-slate-800">
              {contact.email?.trim() || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href={bossHref}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40"
        >
          <p className="text-sm font-semibold text-slate-900">Boss Pro</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Score session, charts, and workshop notes.
          </p>
        </Link>
        <Link
          href={playbooksHref}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40"
        >
          <p className="text-sm font-semibold text-slate-900">Playbooks</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Unlock and track playbook progress for this client.
          </p>
        </Link>
        <button
          type="button"
          onClick={onViewAsClient}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40"
        >
          <p className="text-sm font-semibold text-slate-900">View as client</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Open the client portal as this contact.
          </p>
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50/80 to-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">
          Coaching workspace
        </h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          Use the tabs above for the three-year plan and upcoming tools
          (90-day, revenue, expenses, team). Start with{" "}
          <span className="font-medium text-slate-800">3-Year Plan</span> during
          onboarding.
        </p>
      </section>
    </div>
  );
}
