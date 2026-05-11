"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DirectoryLevelBadge } from "@/components/directory/DirectoryLevelBadge";

type AttendeeCard = {
  slug: string;
  directory_level: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  linkedin_url: string | null;
};

function bioSnippet(text: string | null, max = 200) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export default function AttendeesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [searchDraft, setSearchDraft] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [committedLocation, setCommittedLocation] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [attendees, setAttendees] = useState<AttendeeCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const pageSize = 12;

  useEffect(() => {
    setSearchDraft(sp.get("search") ?? "");
    setCommittedSearch(sp.get("search") ?? "");
    setLocationDraft(sp.get("location") ?? "");
    setCommittedLocation(sp.get("location") ?? "");
    setPage(Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1));
    const v = sp.get("view");
    setView(v === "list" ? "list" : "grid");
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildApiQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (committedSearch.trim()) q.set("search", committedSearch.trim());
    if (committedLocation.trim()) q.set("location", committedLocation.trim());
    if (page > 1) q.set("page", String(page));
    q.set("pageSize", String(pageSize));
    return q.toString();
  }, [committedSearch, committedLocation, page]);

  const buildBrowserQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (committedSearch.trim()) q.set("search", committedSearch.trim());
    if (committedLocation.trim()) q.set("location", committedLocation.trim());
    if (page > 1) q.set("page", String(page));
    if (view === "list") q.set("view", "list");
    return q.toString();
  }, [committedSearch, committedLocation, page, view]);

  const syncUrl = useCallback(() => {
    const qs = buildBrowserQuery();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [buildBrowserQuery, pathname, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = buildApiQuery();
    const res = await fetch(`/api/attendees?${qs}`);
    const body = (await res.json().catch(() => ({}))) as {
      attendees?: AttendeeCard[];
      total?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load attendees.");
      setAttendees([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setAttendees(body.attendees ?? []);
    setTotal(typeof body.total === "number" ? body.total : 0);
    setLoading(false);
  }, [buildApiQuery]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready) return;
    syncUrl();
  }, [ready, committedSearch, committedLocation, page, view, syncUrl]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setCommittedSearch(searchDraft.trim());
    setCommittedLocation(locationDraft.trim());
    setPage(1);
  }

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 px-4 py-16 text-white sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.15),_transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/90">
            Conference
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Who is coming
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-200 sm:text-base">
            Coaches registered to attend — photos, short bios, and links to full
            directory profiles.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <form
          onSubmit={applyFilters}
          className="mb-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="min-w-[12rem] flex-1">
            <label
              htmlFor="att-search"
              className="block text-xs font-medium text-slate-600"
            >
              Search
            </label>
            <input
              id="att-search"
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Name or keyword"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="min-w-[12rem] flex-1">
            <label
              htmlFor="att-location"
              className="block text-xs font-medium text-slate-600"
            >
              Location
            </label>
            <input
              id="att-location"
              type="text"
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value)}
              placeholder="City, region, country"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div
              className="inline-flex rounded-md border border-slate-300 p-0.5 shadow-sm"
              role="group"
              aria-label="Layout"
            >
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`rounded px-2.5 py-2 ${view === "grid" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                aria-pressed={view === "grid"}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
                <span className="sr-only">Grid view</span>
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded px-2.5 py-2 ${view === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                aria-pressed={view === "list"}
                title="List view"
              >
                <List className="h-4 w-4" aria-hidden />
                <span className="sr-only">List view</span>
              </button>
            </div>
            <button
              type="submit"
              className="rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              Search
            </button>
          </div>
        </form>

        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-600">Loading attendees…</p>
        ) : !error && attendees.length === 0 ? (
          <p className="text-sm text-slate-600">
            No attendees match your filters yet.
          </p>
        ) : view === "grid" ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {attendees.map((c) => (
              <li key={c.slug}>
                <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    {c.avatar_url ? (
                      <img
                        src={c.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <DirectoryLevelBadge level={c.directory_level} />
                  <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {c.full_name ?? c.slug}
                      </h2>
                      {c.coach_business_name ? (
                        <p className="text-sm text-slate-600">
                          {c.coach_business_name}
                        </p>
                      ) : null}
                      {c.location ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {c.location}
                        </p>
                      ) : null}
                    </div>
                    {c.bio ? (
                      <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
                        {bioSnippet(c.bio)}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                      <Link
                        href={`/directory/${encodeURIComponent(c.slug)}`}
                        className="inline-flex flex-1 justify-center rounded-md bg-sky-700 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-sky-600"
                      >
                        View profile
                      </Link>
                      {c.linkedin_url ? (
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          LinkedIn
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-4">
            {attendees.map((c) => (
              <li key={c.slug}>
                <article className="flex gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-6 sm:p-5">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-28 sm:w-28">
                    {c.avatar_url ? (
                      <img
                        src={c.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex flex-1 flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {c.full_name ?? c.slug}
                      </h2>
                      <div className="mt-1 max-w-xs">
                        <DirectoryLevelBadge level={c.directory_level} />
                      </div>
                      {c.coach_business_name ? (
                        <p className="text-sm text-slate-600">
                          {c.coach_business_name}
                        </p>
                      ) : null}
                      {c.location ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {c.location}
                        </p>
                      ) : null}
                      {c.bio ? (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          {bioSnippet(c.bio, 320)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-row flex-wrap gap-2 sm:flex-col sm:items-stretch">
                      <Link
                        href={`/directory/${encodeURIComponent(c.slug)}`}
                        className="inline-flex justify-center rounded-md bg-sky-700 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-sky-600"
                      >
                        View profile
                      </Link>
                      {c.linkedin_url ? (
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          LinkedIn
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {!loading && totalPages > 1 ? (
          <nav
            className="mt-10 flex items-center justify-center gap-2"
            aria-label="Pagination"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>
    </>
  );
}
