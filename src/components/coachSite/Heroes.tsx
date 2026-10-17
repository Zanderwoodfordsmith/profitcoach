/* eslint-disable @next/next/no-img-element -- coach photos come from Supabase storage, which next/image is not configured for. */
import { ArrowRight } from "lucide-react";
import type { InlineGraphic } from "@/lib/coachSite/graphics";
import type { CoachSite } from "@/lib/coachSite/types";
import { GapSlab } from "./GapSlab";
import { Graphic } from "./Graphic";
import { TerritoryMap } from "./TerritoryMap";

type HeroProps = { site: CoachSite };

function Headline({ site, bold }: { site: CoachSite; bold?: string }) {
  const line = bold ?? site.shortLine ?? site.positioning ?? "Business coaching for owner-led companies.";
  return (
    <h1 className={`cs-tw cs-display${line.length > 60 ? " cs-display--long" : ""}`}>
      <span className="cs-tw__light">{site.name}, Profit Coach</span>
      <span className="cs-tw__bold">{line}</span>
    </h1>
  );
}

function Standfirst({ site }: HeroProps) {
  const text = site.mediumLine ?? site.intro;
  return text ? <p className="cs-lead">{text}</p> : null;
}

export function HeroActions({ site, light = false }: HeroProps & { light?: boolean }) {
  return (
    <div className="cs-actions">
      <a className={`cs-btn${light ? " cs-btn--light" : ""}`} href={site.links.score}>
        Get your BOSS Score
        <ArrowRight aria-hidden="true" />
      </a>
      <a className="cs-btn cs-btn--outline" href={site.links.book}>
        Book a call
      </a>
    </div>
  );
}

function ProofStrip({ site }: HeroProps) {
  const facts = site.facts.slice(0, 2);
  if (!facts.length) return null;
  return (
    <dl className="cs-hero__proof">
      {facts.map((f) => (
        <div key={f.value + f.label}>
          <dt>{f.value}</dt>
          <dd>{f.label}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The roll's lead: their patch of the country, lit outward from their town. */
export function HeroTerritory({ site }: HeroProps) {
  const place = site.place;
  if (!place || place.lat == null || place.lng == null) return <HeroDossier site={site} />;
  return (
    <section className="cs-hero cs-terr">
      <div className="cs-wrap cs-terr__grid">
        <div className="cs-hero__copy cs-terr__copy">
          <Headline site={site} />
          <Standfirst site={site} />
          <HeroActions site={site} />
          <p className="cs-fine">The BOSS Score is free and takes about 3 minutes.</p>
          <ProofStrip site={site} />
        </div>
        <div className="cs-terr__map">
          <TerritoryMap lat={place.lat} lng={place.lng} place={place.label || site.name} />
        </div>
      </div>
    </section>
  );
}

/** Brochure layout: two-weight headline and a short rule, the portrait over a ledger of their record. */
export function HeroDossier({ site }: HeroProps) {
  const rows = [
    ...(site.place?.label ? [{ value: "Based in", label: site.place.label }] : []),
    ...site.facts.slice(0, 3),
  ];
  return (
    <section className="cs-hero cs-dossier">
      <div className="cs-wrap cs-dossier__grid">
        <div className="cs-hero__copy">
          <Headline site={site} />
          <hr className="cs-dossier__rule" />
          <p className="cs-lead">{site.intro ?? site.mediumLine}</p>
          <HeroActions site={site} />
        </div>
        <div className="cs-dossier__panel">
          {site.photo ? (
            <div className="cs-dossier__photo">
              <img src={site.photo.src} alt={site.photo.alt} fetchPriority="high" />
            </div>
          ) : null}
          {rows.length ? (
            <dl className="cs-ledger">
              {rows.map((r) => (
                <div key={r.value + r.label}>
                  <dt>{r.value}</dt>
                  <dd>{r.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Today against what they want, with a divider to drag between them. */
export function HeroGap({ site }: HeroProps) {
  if (site.gap.length < 2) return <HeroDossier site={site} />;
  return (
    <section className="cs-hero cs-gaphero">
      <div className="cs-wrap cs-gaphero__grid">
        <div className="cs-hero__copy">
          <Headline site={site} />
          <Standfirst site={site} />
          <HeroActions site={site} />
          <ProofStrip site={site} />
        </div>
        <GapSlab rows={site.gap} firstName={site.firstName} />
      </div>
    </section>
  );
}

/** Lead with the instrument: an example BOSS Wheel on the navy band. */
export function HeroWheel({ site, wheel }: HeroProps & { wheel: InlineGraphic }) {
  return (
    <section className="cs-hero cs-wheelhero cs-on-dark">
      <div className="cs-wrap cs-wheelhero__grid">
        <div className="cs-hero__copy">
          <Headline site={site} bold="Your business has a score out of 100. I start every client there." />
          <Standfirst site={site} />
          <HeroActions site={site} light />
          <p className="cs-fine">Free. About 3 minutes. Instant results.</p>
        </div>
        <div className="cs-plate cs-plate--spin">
          <Graphic graphic={wheel} />
          <span className="cs-plate__tag">Example</span>
        </div>
      </div>
    </section>
  );
}
