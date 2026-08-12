"use client";

import Link from "next/link";
import { Linkedin, Plus, Search, UserRound } from "lucide-react";
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

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Your clients
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading
              ? "Loading…"
              : `${filtered.length} client${filtered.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              className="w-44 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-400"
            />
          </label>
          <button
            type="button"
            onClick={onAddClick}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              addActive
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-sky-600 text-white hover:bg-sky-500"
            }`}
          >
            {addActive ? null : <Plus className="h-4 w-4" aria-hidden />}
            {addActive ? "Cancel" : "Add client"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="px-5 py-6 text-sm text-rose-600">{error}</p>
      ) : null}

      {!error && !loading && filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <UserRound className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">No clients yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Add someone with a LinkedIn URL or create them manually — most
              coaches keep a small active roster here.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddClick}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add client
          </button>
        </div>
      ) : null}

      {!error && filtered.length > 0 ? (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => {
            const href = clientWorkspacePath(client.id, "overview", { admin });
            const selected = selectedId === client.id;
            return (
              <li key={client.id}>
                <article
                  className={`group flex h-full flex-col rounded-xl border bg-white p-4 transition hover:border-sky-300 hover:shadow-sm ${
                    selected
                      ? "border-sky-400 ring-1 ring-sky-200"
                      : "border-slate-200"
                  }`}
                >
                  <Link href={href} className="flex flex-1 gap-3">
                    {client.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={client.photo_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                        {initials(client.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-800">
                        {client.full_name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {client.job_title ||
                          client.headline ||
                          client.business_name ||
                          "Client"}
                      </p>
                      {client.business_name &&
                      (client.job_title || client.headline) ? (
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {client.business_name}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    {client.linkedin_url ? (
                      <a
                        href={client.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Linkedin className="h-3.5 w-3.5" aria-hidden />
                        LinkedIn
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                    <div className="flex items-center gap-2">
                      {onViewAsClient ? (
                        <button
                          type="button"
                          onClick={() => onViewAsClient(client.id)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          View as client
                        </button>
                      ) : null}
                      <Link
                        href={href}
                        className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                      >
                        Open →
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}

      {loading && clients.length === 0 && !error ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
