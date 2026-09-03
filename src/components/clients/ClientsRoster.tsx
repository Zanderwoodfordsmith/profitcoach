"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { clientWorkspacePath } from "@/lib/clientCoaching/defaults";

export type ClientRosterItem = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
  job_title?: string | null;
  photo_url?: string | null;
  headline?: string | null;
  linkedin_url?: string | null;
  last_score?: number | null;
};

type Props = {
  clients: ClientRosterItem[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onAddClick: () => void;
  addActive: boolean;
  selectedId?: string | null;
  onViewAsClient?: (contactId: string) => void;
  admin?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function subtitle(client: ClientRosterItem): string {
  return (
    client.job_title ||
    client.headline ||
    client.business_name ||
    client.email ||
    "Client"
  );
}

/**
 * Compact person list for coaching rosters (usually a handful of clients).
 * Empty state is owned by the page (LinkedIn-first onboarding).
 */
export function ClientsRoster({
  clients,
  loading,
  error,
  search,
  onSearchChange,
  onAddClick,
  addActive,
  selectedId,
  onViewAsClient,
  admin = false,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter((c) => {
        const hay = [
          c.full_name,
          c.email,
          c.business_name,
          c.job_title,
          c.headline,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : clients;

  const showSearch = clients.length >= 6;

  if (loading && clients.length === 0 && !error) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading clients">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-slate-100 bg-slate-50"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  if (!loading && clients.length === 0) {
    return null;
  }

  return (
    <section className="w-full max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {filtered.length} client{filtered.length === 1 ? "" : "s"}
          {q && filtered.length !== clients.length
            ? ` matching “${search.trim()}”`
            : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {showSearch ? (
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search"
                className="w-40 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={onAddClick}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              addActive
                ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
                : "bg-sky-700 text-white hover:bg-sky-600"
            }`}
          >
            {addActive ? null : <Plus className="h-4 w-4" aria-hidden />}
            {addActive ? "Cancel" : "Add client"}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
          No clients match that search.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)]">
          {filtered.map((client) => {
            const href = clientWorkspacePath(client.id, "overview", { admin });
            const selected = selectedId === client.id;
            return (
              <li key={client.id}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 transition hover:bg-sky-50/60 ${
                    selected ? "bg-sky-50" : ""
                  }`}
                >
                  <Link
                    href={href}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    {client.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={client.photo_url}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {initials(client.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {client.full_name}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-slate-600">
                        {subtitle(client)}
                      </p>
                    </div>
                    {client.last_score != null ? (
                      <span className="hidden shrink-0 tabular-nums text-xs font-medium text-slate-500 sm:inline">
                        {client.last_score}/100
                      </span>
                    ) : null}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {client.linkedin_url ? (
                      <a
                        href={client.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md p-1.5 text-sky-800 hover:bg-sky-100"
                        title="LinkedIn"
                        aria-label={`LinkedIn profile for ${client.full_name}`}
                      >
                        <LinkedInSolidIcon className="h-4 w-4" />
                      </a>
                    ) : null}
                    {onViewAsClient ? (
                      <button
                        type="button"
                        onClick={() => onViewAsClient(client.id)}
                        className="hidden text-xs font-medium text-slate-600 hover:text-slate-900 sm:inline"
                      >
                        View as
                      </button>
                    ) : null}
                    <Link
                      href={href}
                      className="text-sm font-semibold text-sky-800 hover:text-sky-950"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
