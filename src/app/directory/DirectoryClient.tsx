"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DirectoryLevelBadge } from "@/components/directory/DirectoryLevelBadge";

type CoachCard = {
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

export default function DirectoryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [searchDraft, setSearchDraft] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [locationDraft, setLocationDraft] = useState("");
  const [committedLocation, setCommittedLocation] = useState("");
  const [page, setPage] = useState(1);
  const [coaches, setCoaches] = useState<CoachCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const pageSize = 12;

  useEffect(() => {
    setSearchDraft(sp.get("search") ?? "");
    setCommittedSearch(sp.get("search") ?? "");
    setLevel(sp.get("level") ?? "all");
    setLocationDraft(sp.get("location") ?? "");
    setCommittedLocation(sp.get("location") ?? "");
    setPage(Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1));
    setReady(true);
    // Intentionally once on mount; URL is updated via syncUrl without re-hydrating drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildApiQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (committedSearch.trim()) q.set("search", committedSearch.trim());
    if (level && level !== "all") q.set("level", level);
    if (committedLocation.trim())
      q.set("location", committedLocation.trim());
    if (page > 1) q.set("page", String(page));
    q.set("pageSize", String(pageSize));
    return q.toString();
  }, [committedSearch, level, committedLocation, page]);

  const buildBrowserQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (committedSearch.trim()) q.set("search", committedSearch.trim());
    if (level && level !== "all") q.set("level", level);
    if (committedLocation.trim())
      q.set("location", committedLocation.trim());
    if (page > 1) q.set("page", String(page));
    return q.toString();
  }, [committedSearch, level, committedLocation, page]);

  const syncUrl = useCallback(() => {
    const qs = buildBrowserQuery();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [buildBrowserQuery, pathname, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = buildApiQuery();
    const res = await fetch(`/api/directory/coaches?${qs}`);
    const body = (await res.json().catch(() => ({}))) as {
      coaches?: CoachCard[];
      total?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load the directory.");
      setCoaches([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setCoaches(body.coaches ?? []);
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
  }, [ready, committedSearch, level, committedLocation, page, syncUrl]);

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
            Find a coach
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Profit Coach directory
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-200 sm:text-base">
            Search certified professionals who can help your team build a
            healthier, more profitable business. Connect for an intro and see
            if it is a fit.
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
              htmlFor="dir-search"
              className="block text-xs font-medium text-slate-600"
            >
              Search
            </label>
            <input
              id="dir-search"
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Name or keyword"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="w-full min-w-[10rem] sm:w-40">
            <label
              htmlFor="dir-level"
              className="block text-xs font-medium text-slate-600"
            >
              Level
            </label>
            <select
              id="dir-level"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All levels</option>
              <option value="certified">Certified</option>
              <option value="professional">Professional</option>
              <option value="elite">Elite</option>
            </select>
          </div>
          <div className="min-w-[12rem] flex-1">
            <label
              htmlFor="dir-location"
              className="block text-xs font-medium text-slate-600"
            >
              Location
            </label>
            <input
              id="dir-location"
              type="text"
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value)}
              placeholder="City, region, country"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
          >
            Search
          </button>
        </form>

        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-600">Loading coaches…</p>
        ) : !error && coaches.length === 0 ? (
          <p className="text-sm text-slate-600">
            No coaches match your filters yet.
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c) => (
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
