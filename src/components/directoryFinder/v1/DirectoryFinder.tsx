"use client";

import { ArrowRight, Award, MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DirectoryCard } from "@/lib/directoryPage/list";
import { UK_REGIONS, regionLabel } from "@/lib/directoryPage/places";
import { DotMap, areaLabel, areaOf, type MapView } from "./DotMap";
import "./directoryFinder.css";

type Props = {
  cards: DirectoryCard[];
  /** Coach of the month, shown across the top while browsing. */
  featuredSlug: string | null;
  initialArea: string | null;
  initialQuery: string;
};

function coachesCount(n: number) {
  return `${n} coach${n === 1 ? "" : "es"}`;
}

/** "the North West", "the United Kingdom", but "London", "Wales". */
function withThe(label: string) {
  return /^(north|south|east|west|united)/i.test(label) ? `the ${label}` : label;
}

function searchText(c: DirectoryCard) {
  return [c.name, c.business, c.location, c.line, c.place?.region ? regionLabel(c.place.region) : ""]
    .join(" ")
    .toLowerCase();
}

function Name({ card, as: Tag = "h3", className }: { card: DirectoryCard; as?: "h2" | "h3"; className: string }) {
  return (
    <Tag className={className}>
      {card.restName ? (
        <>
          <span>{card.firstName}</span> <strong>{card.restName}</strong>
        </>
      ) : (
        <strong>{card.firstName}</strong>
      )}
    </Tag>
  );
}

function Photo({ card }: { card: DirectoryCard }) {
  return card.avatarUrl ? (
    <img
      src={card.avatarUrl}
      alt=""
      loading="lazy"
      style={{ objectPosition: `${card.focus.x}% ${card.focus.y}%` }}
    />
  ) : (
    <span className="dv1-monogram" aria-hidden>
      {card.firstName.charAt(0)}
    </span>
  );
}

/**
 * The public coach directory. A sticky charcoal finder (search and a dot map
 * of where coaches are) beside a light column of portraits, the same build as
 * a coach's own page. Every listed coach loads at once and filters in place.
 */
export function DirectoryFinder({ cards, featuredSlug, initialArea, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [area, setArea] = useState<string | null>(initialArea);
  const [view, setView] = useState<MapView>(initialArea?.startsWith("country:") ? "world" : "uk");
  const [hover, setHover] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);

  // Keep the address shareable: /directory?area=north-west&q=tech
  useEffect(() => {
    const qs = new URLSearchParams();
    if (area) qs.set("area", area);
    if (query.trim()) qs.set("q", query.trim());
    const next = qs.toString() ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", next);
  }, [area, query]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cards.filter((c) => searchText(c).includes(q)) : cards;
  }, [cards, query]);

  const shown = useMemo(
    () =>
      area
        ? searched.filter((c) =>
            area.startsWith("country:") ? c.place?.country === area.slice(8) : c.place?.region === area,
          )
        : searched,
    [searched, area],
  );

  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of searched) {
      const a = areaOf(c, view);
      if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    if (view === "uk") return UK_REGIONS.filter((r) => counts.has(r.id)).map((r) => ({ id: r.id as string, n: counts.get(r.id)! }));
    return [...counts].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || areaLabel(a.id).localeCompare(areaLabel(b.id)));
  }, [searched, view]);

  const browsing = !area && !query.trim();
  const featured = browsing ? (cards.find((c) => c.slug === featuredSlug) ?? null) : null;
  const grid = featured ? shown.filter((c) => c !== featured) : shown;

  return (
    <div className="dv1">
      <aside className="dv1-aside" aria-label="Find a coach">
        <div className="dv1-intro">
          <h1 className="dv1-title">
            <span>Find your</span>
            <strong>Profit Coach</strong>
          </h1>
          <p className="dv1-sub">
            {cards.length} coaches, one system. Every coach here works from the same BOSS Score and the same 50
            playbooks.
          </p>
          <label className="dv1-search">
            <Search aria-hidden />
            <span className="sr-only">Search coaches</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, town or business"
              autoComplete="off"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X aria-hidden />
              </button>
            ) : null}
          </label>
        </div>

        <div className="dv1-finder">
          <div className="dv1-scope" role="group" aria-label="Map">
            {(["uk", "world"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                {v === "uk" ? "UK & Ireland" : "World"}
              </button>
            ))}
          </div>

          <div className="dv1-stage">
            <DotMap
              view={view}
              cards={searched}
              area={area}
              hover={hover}
              hot={hot}
              onArea={setArea}
              onHover={setHover}
            />

            <ul className="dv1-areas" aria-label={view === "uk" ? "Regions" : "Countries"}>
              <li>
                <button type="button" aria-pressed={!area} onClick={() => setArea(null)}>
                  <span>All coaches</span>
                  <span className="dv1-areas__n">{searched.length}</span>
                </button>
              </li>
              {areas.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-pressed={area === a.id}
                    data-hover={hover === a.id || undefined}
                    onClick={() => setArea(area === a.id ? null : a.id)}
                    onPointerEnter={() => setHover(a.id)}
                    onPointerLeave={() => setHover(null)}
                  >
                    <span>{areaLabel(a.id)}</span>
                    <span className="dv1-areas__n">{a.n}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="dv1-main">
        {featured ? (
          <section className="dv1-feature" aria-labelledby="dv1-feature-name">
            <Link href={`/directory/${featured.slug}`} className="dv1-feature__photo" tabIndex={-1} aria-hidden>
              <Photo card={featured} />
              <span className="dv1-badge">
                <Award aria-hidden />
                Coach of the month
              </span>
            </Link>
            <div className="dv1-feature__body">
              <h2 id="dv1-feature-name" className="dv1-feature__name">
                {featured.restName ? (
                  <>
                    <span>{featured.firstName}</span>
                    <strong>{featured.restName}</strong>
                  </>
                ) : (
                  <strong>{featured.firstName}</strong>
                )}
              </h2>
              <p className="dv1-meta">
                {[featured.business, featured.location].filter(Boolean).join(" · ")}
              </p>
              {featured.line ? <p className="dv1-feature__line">{featured.line}</p> : null}
              <Link href={`/directory/${featured.slug}`} className="dv1-btn dv1-btn--navy">
                Meet {featured.firstName}
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </section>
        ) : null}

        <div className="dv1-head">
          <h2 className="dv1-h2" aria-live="polite">
            {area ? (
              <>
                <span>Coaches in</span> {withThe(areaLabel(area))}
              </>
            ) : query.trim() ? (
              <>
                <span>Coaches matching</span> “{query.trim()}”
              </>
            ) : (
              <>
                <span>Meet the</span> coaches
              </>
            )}
          </h2>
          <p className="dv1-count">
            {coachesCount(shown.length)}
            {area || query.trim() ? (
              <button
                type="button"
                className="dv1-clear"
                onClick={() => {
                  setArea(null);
                  setQuery("");
                }}
              >
                Show all
                <X aria-hidden />
              </button>
            ) : null}
          </p>
        </div>

        {grid.length ? (
          <ul className="dv1-grid">
            {grid.map((card) => (
              <li key={card.slug}>
                <Link
                  href={`/directory/${card.slug}`}
                  className="dv1-card"
                  onPointerEnter={() => setHot(card.slug)}
                  onPointerLeave={() => setHot(null)}
                  onFocus={() => setHot(card.slug)}
                  onBlur={() => setHot(null)}
                >
                  <div className="dv1-card__photo">
                    <Photo card={card} />
                  </div>
                  <Name card={card} className="dv1-card__name" />
                  {card.location ? (
                    <p className="dv1-card__place">
                      <MapPin aria-hidden />
                      <span>{card.location}</span>
                    </p>
                  ) : null}
                  {card.line ? <p className="dv1-card__line">{card.line}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : shown.length ? null : (
          <div className="dv1-empty">
            <p>No coaches match that yet.</p>
            <button
              type="button"
              className="dv1-btn dv1-btn--outline"
              onClick={() => {
                setArea(null);
                setQuery("");
              }}
            >
              Show all coaches
            </button>
          </div>
        )}

        <section className="dv1-score" aria-labelledby="dv1-score-h">
          <h2 id="dv1-score-h">
            <span>Not sure who to pick?</span>
            Start with your BOSS Score.
          </h2>
          <p>
            It checks 10 areas of your business and scores each one. Then talk it through with any coach here.
          </p>
          <div className="dv1-actions">
            <Link className="dv1-btn dv1-btn--light" href="/score">
              Get your free BOSS Score
              <ArrowRight aria-hidden />
            </Link>
            <span className="dv1-fine">Free. 50 questions. About 10 minutes.</span>
          </div>
        </section>
      </main>
    </div>
  );
}
