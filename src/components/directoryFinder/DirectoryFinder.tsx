"use client";

import { ArrowRight, Award, MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { DirectoryCard } from "@/lib/directoryPage/list";
import { UK_REGIONS, regionLabel } from "@/lib/directoryPage/places";
import { ABROAD, DotMap, areaLabel, areaOf } from "./DotMap";
import "./directoryFinder.css";

type Props = {
  cards: DirectoryCard[];
  /** Coach of the month, shown as a full row after the first coaches while browsing. */
  featuredSlug: string | null;
  initialArea: string | null;
  initialIndustry: string | null;
  initialQuery: string;
};

/** Coach of the month comes after this many cards, so the first screen shows a choice. */
const FEATURE_AFTER = 6;

function coachesCount(n: number) {
  return `${n} coach${n === 1 ? "" : "es"}`;
}

/** "the North West", but "London", "Wales". */
function withThe(label: string) {
  return /^(north|south|east|west)/i.test(label) ? `the ${label}` : label;
}

function searchText(c: DirectoryCard) {
  return [c.name, c.business, c.location, c.line, c.place?.region ? regionLabel(c.place.region) : "", ...c.industries]
    .join(" ")
    .toLowerCase();
}

function inArea(c: DirectoryCard, area: string | null) {
  return !area || areaOf(c) === area;
}

function inIndustry(c: DirectoryCard, industry: string | null) {
  return !industry || c.industries.some((i) => i.toLowerCase() === industry.toLowerCase());
}

function Name({ card }: { card: DirectoryCard }) {
  return (
    <h3 className="dd-card__name">
      {card.restName ? (
        <>
          <span>{card.firstName}</span> <strong>{card.restName}</strong>
        </>
      ) : (
        <strong>{card.firstName}</strong>
      )}
    </h3>
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
    <span className="dd-monogram" aria-hidden>
      {card.firstName.charAt(0)}
    </span>
  );
}

/**
 * The public coach directory. A sticky charcoal column (search and a dot map
 * of the UK) beside a light column of filters and portraits, the same build
 * as a coach's own page. Every listed coach loads at once and filters in place.
 */
export function DirectoryFinder({ cards, featuredSlug, initialArea, initialIndustry, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [area, setArea] = useState<string | null>(initialArea);
  const [industry, setIndustry] = useState<string | null>(initialIndustry);
  const [hover, setHover] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);

  // Keep the address shareable: /directory?area=north-west&industry=Property
  useEffect(() => {
    const qs = new URLSearchParams();
    if (area) qs.set("area", area);
    if (industry) qs.set("industry", industry);
    if (query.trim()) qs.set("q", query.trim());
    const next = qs.toString() ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", next);
  }, [area, industry, query]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cards.filter((c) => searchText(c).includes(q)) : cards;
  }, [cards, query]);

  // Each filter's counts follow the other filters.
  const forAreas = useMemo(() => searched.filter((c) => inIndustry(c, industry)), [searched, industry]);
  const forIndustries = useMemo(() => searched.filter((c) => inArea(c, area)), [searched, area]);
  const shown = useMemo(() => forAreas.filter((c) => inArea(c, area)), [forAreas, area]);

  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of forAreas) {
      const a = areaOf(c);
      if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    const ids = [...UK_REGIONS.map((r) => r.id as string), ABROAD];
    return ids.filter((id) => counts.has(id) || id === area).map((id) => ({ id, n: counts.get(id) ?? 0 }));
  }, [forAreas, area]);

  const industries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of forIndustries) for (const i of c.industries) counts.set(i, (counts.get(i) ?? 0) + 1);
    if (industry && !counts.has(industry)) counts.set(industry, 0);
    return [...counts].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  }, [forIndustries, industry]);

  const filtered = Boolean(area || industry || query.trim());
  const featured = filtered ? null : (cards.find((c) => c.slug === featuredSlug) ?? null);
  const grid = featured ? shown.filter((c) => c !== featured) : shown;
  const featureAt = Math.min(FEATURE_AFTER, grid.length);

  const titleParts = [
    area ? (area === ABROAD ? "outside the UK" : `in ${withThe(areaLabel(area))}`) : "",
    industry ? `for ${industry}` : "",
    query.trim() ? `matching “${query.trim()}”` : "",
  ].filter(Boolean);

  function clearAll() {
    setArea(null);
    setIndustry(null);
    setQuery("");
  }

  return (
    <div className="dd">
      <aside className="dd-aside" aria-label="Find a coach">
        <div className="dd-intro">
          <h1 className="dd-title">
            <span>Find your</span>
            <strong>Profit Coach</strong>
          </h1>
          <p className="dd-sub">
            {cards.length} coaches, one system. Every coach here works from the same BOSS Score and the same 50
            playbooks.
          </p>
          <label className="dd-search">
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

        <div className="dd-finder">
          <DotMap cards={forAreas} area={area} hover={hover} hot={hot} onArea={setArea} onHover={setHover} />
          <p className="dd-hint">Pick a region on the map to see its coaches.</p>
        </div>
      </aside>

      <main className="dd-main">
        <div className="dd-head">
          <h2 className="dd-h2" aria-live="polite">
            {titleParts.length ? (
              <>
                <span>Coaches</span> {titleParts.join(" ")}
              </>
            ) : (
              <>
                <span>Meet the</span> coaches
              </>
            )}
          </h2>
          <p className="dd-count">
            {coachesCount(shown.length)}
            {filtered ? (
              <button type="button" className="dd-clear" onClick={clearAll}>
                Show all
                <X aria-hidden />
              </button>
            ) : null}
          </p>
        </div>

        <div className="dd-filters">
          <div className="dd-filter" role="group" aria-labelledby="dd-where">
            <span className="dd-filter__label" id="dd-where">
              Where
            </span>
            <div className="dd-filter__chips">
              <button type="button" className="dd-fchip" aria-pressed={!area} onClick={() => setArea(null)}>
                Anywhere
              </button>
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="dd-fchip"
                  aria-pressed={area === a.id}
                  data-hover={hover === a.id || undefined}
                  onClick={() => setArea(area === a.id ? null : a.id)}
                  onPointerEnter={() => setHover(a.id === ABROAD ? null : a.id)}
                  onPointerLeave={() => setHover(null)}
                >
                  {areaLabel(a.id)}
                  <span className="dd-fchip__n">{a.n}</span>
                </button>
              ))}
            </div>
          </div>
          {industries.length ? (
            <div className="dd-filter" role="group" aria-labelledby="dd-industry">
              <span className="dd-filter__label" id="dd-industry">
                Industry
              </span>
              <div className="dd-filter__chips">
                <button type="button" className="dd-fchip" aria-pressed={!industry} onClick={() => setIndustry(null)}>
                  Any
                </button>
                {industries.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="dd-fchip"
                    aria-pressed={industry === i.id}
                    onClick={() => setIndustry(industry === i.id ? null : i.id)}
                  >
                    {i.id}
                    <span className="dd-fchip__n">{i.n}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {grid.length || featured ? (
          <ul className="dd-grid">
            {grid.map((card, index) => (
              <Fragment key={card.slug}>
                {featured && index === featureAt ? <FeatureRow card={featured} /> : null}
                <li>
                  <Link
                    href={`/directory/${card.slug}`}
                    className="dd-card"
                    onPointerEnter={() => setHot(card.slug)}
                    onPointerLeave={() => setHot(null)}
                    onFocus={() => setHot(card.slug)}
                    onBlur={() => setHot(null)}
                  >
                    <div className="dd-card__photo">
                      <Photo card={card} />
                    </div>
                    <Name card={card} />
                    {card.location ? (
                      <p className="dd-card__place">
                        <MapPin aria-hidden />
                        <span>{card.location}</span>
                      </p>
                    ) : null}
                    {card.line ? <p className="dd-card__line">{card.line}</p> : null}
                  </Link>
                </li>
              </Fragment>
            ))}
            {featured && featureAt === grid.length ? <FeatureRow card={featured} /> : null}
          </ul>
        ) : (
          <div className="dd-empty">
            <p>No coaches match that yet.</p>
            <button type="button" className="dd-btn dd-btn--outline" onClick={clearAll}>
              Show all coaches
            </button>
          </div>
        )}

        <section className="dd-score" aria-labelledby="dd-score-h">
          <h2 id="dd-score-h">
            <span>Not sure who to pick?</span>
            Start with your BOSS Score.
          </h2>
          <p>
            It checks 10 areas of your business and scores each one. Then talk it through with any coach here.
          </p>
          <div className="dd-actions">
            <Link className="dd-btn dd-btn--light" href="/score">
              Get your free BOSS Score
              <ArrowRight aria-hidden />
            </Link>
            <span className="dd-fine">Free. 50 questions. About 10 minutes.</span>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Coach of the month: one coach across a whole row of the grid. */
function FeatureRow({ card }: { card: DirectoryCard }) {
  return (
    <li className="dd-feature-row">
      <section className="dd-feature" aria-labelledby="dd-feature-name">
        <Link href={`/directory/${card.slug}`} className="dd-feature__photo" tabIndex={-1} aria-hidden>
          <Photo card={card} />
          <span className="dd-badge">
            <Award aria-hidden />
            Coach of the month
          </span>
        </Link>
        <div className="dd-feature__body">
          <h2 id="dd-feature-name" className="dd-feature__name">
            {card.restName ? (
              <>
                <span>{card.firstName}</span>
                <strong>{card.restName}</strong>
              </>
            ) : (
              <strong>{card.firstName}</strong>
            )}
          </h2>
          <p className="dd-meta">{[card.business, card.location].filter(Boolean).join(" · ")}</p>
          {card.line ? <p className="dd-feature__line">{card.line}</p> : null}
          <Link href={`/directory/${card.slug}`} className="dd-btn dd-btn--navy">
            Meet {card.firstName}
            <ArrowRight aria-hidden />
          </Link>
        </div>
      </section>
    </li>
  );
}
