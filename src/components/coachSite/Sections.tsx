/* eslint-disable @next/next/no-img-element -- coach photos come from Supabase storage, which next/image is not configured for. */
import { ArrowRight, Check, CircleAlert, Gauge, Layers, ListChecks, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { BOSS_SCORE_SATURATED, BOSS_SCORE_SATURATED_DEEP } from "@/lib/bossScorecardColors";
import { LEVEL_DESCRIPTIONS } from "@/lib/bossScorecardCopy";
import type { CoachSiteGraphics } from "@/lib/coachSite/graphics";
import type { CoachSite, CoachSiteSource } from "@/lib/coachSite/types";
import { Graphic } from "./Graphic";
import { OptIn } from "./OptIn";

type P = { site: CoachSite };

/** Preview only: says which Blueprint section would fill this part of the page. */
export function Needs({ what, preview }: { what: string; preview: boolean }) {
  if (!preview) return null;
  return (
    <p className="cs-needs">
      <CircleAlert aria-hidden="true" />
      Needs {what} in the Blueprint. Hidden on a live site until it is written.
    </p>
  );
}

function TwoWeight({ light, bold, id }: { light: string; bold: string; id?: string }) {
  return (
    <h2 className="cs-tw cs-h2" id={id}>
      <span className="cs-tw__light">{light}</span>
      <span className="cs-tw__bold">{bold}</span>
    </h2>
  );
}

/* ---------- Their words ---------- */

export function OwnerWords({ site, preview }: P & { preview: boolean }) {
  if (!site.ownerWords.length && !site.whoIHelp) {
    return preview ? (
      <section className="cs-section">
        <div className="cs-wrap">
          <Needs what="the One-page Profile" preview />
        </div>
      </section>
    ) : null;
  }
  return (
    <section className="cs-section" aria-labelledby="cs-words-title">
      <div className="cs-wrap">
        <div className="cs-head">
          <TwoWeight
            id="cs-words-title"
            light="Sound familiar?"
            bold={`The problems ${site.firstName} fixes, in owners' own words.`}
          />
        </div>
        {site.ownerWords.length ? (
          <ul className="cs-words">
            {site.ownerWords.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        {site.whoIHelp ? (
          <div className="cs-who">
            <h3 className="cs-h3">Who {site.firstName} works with</h3>
            <p className="cs-body">{site.whoIHelp}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- The gap (scroll moment) ---------- */

export function GapLedger({ site }: P) {
  if (site.gap.length < 2) return null;
  return (
    <section className="cs-section cs-section--canvas" aria-labelledby="cs-gap-title">
      <div className="cs-wrap">
        <div className="cs-head">
          <TwoWeight id="cs-gap-title" light="Where you are." bold="Where you want to be." />
        </div>
        <div className="cs-gap" role="table" aria-label="Today, and what you want">
          <div className="cs-gap__head" role="row">
            <span role="columnheader">Today</span>
            <span aria-hidden="true" />
            <span role="columnheader">What you want</span>
          </div>
          {site.gap.map((row) => (
            <div className="cs-gap__row" role="row" key={row.today}>
              <p className="cs-gap__today" role="cell">
                {row.today}
              </p>
              <span className="cs-gap__arrow" aria-hidden="true">
                <ArrowRight />
              </span>
              <p className="cs-gap__want" role="cell">
                {row.want}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- The score ---------- */

const GETS = [
  { icon: Gauge, title: "A score out of 100", body: "Across ten areas of the business, including you as the owner." },
  { icon: Layers, title: "Your level", body: "Where you sit today, from Overwhelm to Owner." },
  { icon: ListChecks, title: "The three areas to fix first", body: "So the first conversation starts on your numbers." },
  { icon: Timer, title: "About 3 minutes", body: "Free, with your results straight away." },
];

export function ScoreBand({ site, graphics }: P & { graphics: CoachSiteGraphics }) {
  return (
    <section className="cs-section cs-score cs-on-dark" aria-labelledby="cs-score-title">
      <div className="cs-wrap cs-score__grid">
        <div style={{ display: "grid", gap: 32 }}>
          <TwoWeight id="cs-score-title" light="Start with your BOSS Score." bold="Then you know what to fix first." />
          <ul className="cs-gets">
            {GETS.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="cs-actions">
            <a className="cs-btn cs-btn--light" href={site.links.score}>
              Get your BOSS Score
              <ArrowRight aria-hidden="true" />
            </a>
            <a className="cs-link" href={site.links.assessment}>
              Go straight to the questions
            </a>
          </div>
        </div>
        <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
          <div className="cs-plate">
            <Graphic graphic={graphics.wheel} />
            <span className="cs-plate__tag">Example</span>
          </div>
          <p className="cs-fine">An example BOSS Wheel. Yours shows your own ten scores.</p>
        </div>
      </div>
    </section>
  );
}

export function OldNew({ site, graphics }: P & { graphics: CoachSiteGraphics }) {
  return (
    <section className="cs-section" aria-labelledby="cs-oldnew-title">
      <div className="cs-wrap">
        <div className="cs-head cs-head--center">
          <TwoWeight id="cs-oldnew-title" light="Two ways to run the same business." bold="From your head, or from your score." />
          <p className="cs-lead">
            Most owners run the business from a whiteboard in their head. The BOSS Score puts it on one page,
            so you can see what is strong, what is holding you back, and what to fix next.
          </p>
        </div>
        <div className="cs-oldnew">
          <Graphic graphic={graphics.oldNew} />
        </div>
        <div className="cs-actions" style={{ justifyContent: "center", marginTop: 40 }}>
          <a className="cs-btn" href={site.links.score}>
            Get your BOSS Score
            <ArrowRight aria-hidden="true" />
          </a>
          <a className="cs-link" href={site.links.assessment}>
            Go straight to the questions
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------- Method ---------- */

export function Method({ site, preview }: P & { preview: boolean }) {
  if (!site.method.length) {
    return preview ? (
      <section className="cs-section" id="how">
        <div className="cs-wrap">
          <Needs what="How I work (One-page Profile)" preview />
        </div>
      </section>
    ) : null;
  }
  return (
    <section className="cs-section cs-section--canvas" id="how" aria-labelledby="cs-how-title">
      <div className="cs-wrap">
        <div className="cs-head">
          <TwoWeight id="cs-how-title" light="How it works." bold="From your first score to results you can see." />
        </div>
        <ol className="cs-steps" style={{ ["--cs-step-count" as string]: Math.min(site.method.length, 4) }}>
          {site.method.map((step, i) => (
            <li key={step.title}>
              <span className="cs-step__n cs-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="cs-h3">{step.title}</h3>
              <p className="cs-body">{step.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- The Profit System ---------- */

const LEVELS = [
  { n: 5, name: "Owner", key: "Owner" },
  { n: 4, name: "Overseer", key: "Overseer" },
  { n: 3, name: "Organised", key: "Organised" },
  { n: 2, name: "Overworked", key: "Overworked" },
  { n: 1, name: "Overwhelm", key: "Overwhelmed" },
] as const;

export function ProfitSystem({ site, graphics }: P & { graphics: CoachSiteGraphics }) {
  return (
    <section className="cs-section" aria-labelledby="cs-system-title">
      <div className="cs-wrap cs-system">
        <div className="cs-system__map">
          <Graphic graphic={graphics.playbooks} />
        </div>
        <div style={{ display: "grid", gap: 28 }}>
          <TwoWeight id="cs-system-title" light="The Profit System." bold="50 playbooks. Ten areas. Five levels." />
          <p className="cs-body">
            Every fix comes from one map. Your BOSS Score shows where each part of the business sits today, so{" "}
            {site.firstName} works on the playbook that pays most next, in the right order.
          </p>
          <ol className="cs-levels" aria-label="The five levels, from Owner down to Overwhelm">
            {LEVELS.map((l) => (
              <li
                key={l.n}
                style={{
                  ["--lvl" as string]: BOSS_SCORE_SATURATED[l.n],
                  ["--lvl-deep" as string]: BOSS_SCORE_SATURATED_DEEP[l.n],
                }}
              >
                <span className="cs-levels__n cs-num" aria-hidden="true">
                  {l.n}
                </span>
                <div>
                  <strong>{l.name}</strong>
                  <span>{LEVEL_DESCRIPTIONS[l.key]}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------- Offer ---------- */

export function Offer({ site, preview }: P & { preview: boolean }) {
  const offer = site.offer;
  if (!offer) {
    return preview ? (
      <section className="cs-section">
        <div className="cs-wrap">
          <Needs what="Offer and positioning" preview />
        </div>
      </section>
    ) : null;
  }
  const terms: { label: string; value: string | null }[] = [
    { label: "Who it is for", value: offer.whoFor },
    { label: "What is included", value: offer.included },
    { label: "How it runs", value: offer.format },
  ];
  return (
    <section className="cs-section cs-section--canvas" id="work" aria-labelledby="cs-offer-title">
      <div className="cs-wrap cs-offer">
        <div style={{ display: "grid", gap: 28 }}>
          <TwoWeight id="cs-offer-title" light={`Working with ${site.firstName}.`} bold={offer.name ?? "The programme"} />
          {offer.promise ? <p className="cs-offer__promise">{offer.promise}</p> : null}
          <div className="cs-actions">
            <a className="cs-btn" href={site.links.book}>
              Book a call with {site.firstName}
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
        <dl className="cs-ledger cs-offer__terms">
          {terms
            .filter((t) => t.value)
            .map((t) => (
              <div key={t.label}>
                <dt>{t.label}</dt>
                <dd>{t.value}</dd>
              </div>
            ))}
        </dl>
      </div>
    </section>
  );
}

/* ---------- Proof ---------- */

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function QuoteFigure({ site }: P) {
  const q = site.testimonials[0];
  if (!q) return null;
  const [who, ...role] = q.cite.split(",");
  return (
    <figure className="cs-quote">
      <blockquote>{q.quote}</blockquote>
      <figcaption>
        {who.trim()}
        {role.length ? <span>{capitalise(role.join(",").trim())}</span> : null}
      </figcaption>
    </figure>
  );
}

export function ProofLedger({ site, preview }: P & { preview: boolean }) {
  if (!site.testimonials.length && !site.facts.length) {
    return preview ? (
      <section className="cs-section" id="proof">
        <div className="cs-wrap">
          <Needs what="a testimonial and the Short bio" preview />
        </div>
      </section>
    ) : null;
  }
  return (
    <section className="cs-section" id="proof" aria-labelledby="cs-proof-title">
      <div className="cs-wrap">
        <div className="cs-head">
          <TwoWeight id="cs-proof-title" light={`Why owners listen to ${site.firstName}.`} bold="The record, in plain numbers." />
        </div>
        <div className="cs-proof">
          <div>
            {site.testimonials.length ? <QuoteFigure site={site} /> : <Needs what="a client testimonial" preview={preview} />}
          </div>
          <div>
            {site.facts.length ? (
              <dl className="cs-ledger cs-facts">
                {site.facts.map((f) => (
                  <div key={f.value + f.label}>
                    <dt>{f.value}</dt>
                    <dd>{f.label}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {/* The written results mostly restate the record; show them only when the record is thin. */}
            {site.results.length && site.facts.length < 3 ? (
              <ul className="cs-results">
                {site.results.map((r) => (
                  <li key={r}>
                    <Check aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProofBand({ site, preview }: P & { preview: boolean }) {
  if (!site.testimonials.length) return <ProofLedger site={site} preview={preview} />;
  const photo = site.photo;
  return (
    <section className="cs-section cs-proofband cs-on-dark" id="proof" aria-label="What clients say">
      <div className="cs-wrap">
        <div className="cs-proofband__grid">
          <QuoteFigure site={site} />
          {photo ? (
            <div className="cs-proofband__photo">
              <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
            </div>
          ) : null}
        </div>
        {site.facts.length ? (
          <dl className="cs-proofband__facts">
            {site.facts.map((f) => (
              <div key={f.value + f.label}>
                <dt className="cs-num">{f.value}</dt>
                <dd>{f.label}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- About ---------- */

export function About({ site, preview }: P & { preview: boolean }) {
  const photo = site.stagePhoto ?? site.photo;
  if (!site.bio && !site.whyMe.length) {
    return preview ? (
      <section className="cs-section" id="about">
        <div className="cs-wrap">
          <Needs what="the Short bio" preview />
        </div>
      </section>
    ) : null;
  }
  return (
    <section className="cs-section cs-section--canvas" id="about" aria-labelledby="cs-about-title">
      <div className="cs-wrap cs-about">
        <div className="cs-about__media">
          {photo ? (
            <div className="cs-about__photo">
              <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
            </div>
          ) : null}
          {site.linkedinUrl ? (
            <a className="cs-link" href={site.linkedinUrl} target="_blank" rel="noopener noreferrer">
              {site.firstName} on LinkedIn
              <ArrowRight aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <div>
          <div className="cs-head" style={{ marginBottom: 32 }}>
            <TwoWeight id="cs-about-title" light={`About ${site.firstName}.`} bold={site.name} />
          </div>
          {site.bio ? <p className="cs-about__bio">{site.bio}</p> : null}
          {/* "Why you" is the coach's proof stack. With a bio it mostly repeats it, so it only stands in for one. */}
          {!site.bio && site.whyMe.length ? (
            <ul className="cs-why">
              {site.whyMe.map((w) => (
                <li key={w}>
                  <Check aria-hidden="true" />
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- Opt-in ---------- */

export function TakeItHome({
  site,
  graphics,
  preview,
}: P & { graphics: CoachSiteGraphics; preview: boolean }) {
  return (
    <section className="cs-section" id="scorecard" aria-labelledby="cs-optin-title">
      <div className="cs-wrap cs-optin">
        <div className="cs-sheets" aria-hidden="true">
          <div className="cs-sheet cs-sheet--a4">
            <Graphic graphic={graphics.scorecard} />
          </div>
          <div className="cs-sheet cs-sheet--map">
            <Graphic graphic={graphics.playbooks} />
          </div>
        </div>
        <div>
          <TwoWeight id="cs-optin-title" light="Take it home." bold="The BOSS Scorecard, printed for your desk." />
          <p className="cs-lead" style={{ marginTop: 24 }}>
            One page, thirteen questions, every area of the business. Score it with a pen, then scan the code
            for your full result. The map of all 50 playbooks comes with it.
          </p>
          <OptIn
            slug={site.slug}
            firstName={site.firstName}
            scorecard={graphics.scorecardFile}
            playbooks={graphics.playbooksFile}
            preview={preview}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- Close ---------- */

export function CloseScore({ site }: P) {
  return (
    <section className="cs-section cs-close" aria-labelledby="cs-close-title">
      <div className="cs-wrap cs-close__inner">
        <TwoWeight id="cs-close-title" light="Find out where you stand." bold="Get your BOSS Score." />
        <p className="cs-lead">
          About 3 minutes, free, with your results straight away. Then, if it helps, talk it through with{" "}
          {site.firstName}.
        </p>
        <div className="cs-actions">
          <a className="cs-btn" href={site.links.score}>
            Get your BOSS Score
            <ArrowRight aria-hidden="true" />
          </a>
          <a className="cs-btn cs-btn--outline" href={site.links.book}>
            Book a call with {site.firstName}
          </a>
        </div>
      </div>
    </section>
  );
}

export function CloseCall({ site }: P) {
  return (
    <section className="cs-section cs-close cs-close--call cs-on-dark" aria-labelledby="cs-close-title">
      <div className="cs-wrap cs-callgrid">
        {site.photo ? (
          <div className="cs-callgrid__photo">
            <img src={site.photo.src} alt={site.photo.alt} loading="lazy" decoding="async" />
          </div>
        ) : null}
        <div className="cs-callgrid__copy">
          <TwoWeight id="cs-close-title" light="Talk it through." bold={`Book a call with ${site.firstName}.`} />
          <p className="cs-lead">
            Bring your BOSS Score if you have one, or just your numbers. You will look together at what to fix
            first.
          </p>
          <div className="cs-actions">
            <a className="cs-btn cs-btn--light" href={site.links.book}>
              Book a call
              <ArrowRight aria-hidden="true" />
            </a>
            <a className="cs-link" href={site.links.score}>
              Or get your BOSS Score first
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

export function Footer({ site }: P) {
  const year = new Date().getFullYear();
  return (
    <footer className="cs-footer">
      <div className="cs-wrap">
        <div className="cs-footer__top">
          <div style={{ display: "grid", gap: 6 }}>
            <span className="cs-footer__name">{site.name}</span>
            <span>
              Certified Profit Coach{site.place?.label ? `, ${site.place.label}` : ""}
            </span>
          </div>
          <nav className="cs-footer__links" aria-label="Footer">
            <a href={site.links.score}>BOSS Score</a>
            <a href={site.links.book}>Book a call</a>
            <a href="#scorecard">Free scorecard</a>
            {site.linkedinUrl ? (
              <a href={site.linkedinUrl} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            ) : null}
          </nav>
        </div>
        <div className="cs-footer__bottom">
          <span>
            © {year} {site.name}. Part of The Profit Coach network.
          </span>
          <img className="cs-footer__logo" src="/brand/profit-coach-logo-white.svg" alt="The Profit Coach" />
        </div>
      </div>
    </footer>
  );
}

/* ---------- Nav ---------- */

export function Nav({ site, children }: P & { children?: ReactNode }) {
  return (
    <header className="cs-nav">
      <div className="cs-wrap cs-nav__inner">
        <a className="cs-brand" href="#top" aria-label={`${site.name}, home`}>
          <span className="cs-brand__name">{site.name}</span>
          <span className="cs-brand__rule" aria-hidden="true" />
          <img className="cs-brand__logo" src="/profit-coach-logo.svg" alt="The Profit Coach" />
        </a>
        <nav className="cs-nav__links" aria-label="Main">
          <a className="cs-nav__link" href="#how">
            How it works
          </a>
          <a className="cs-nav__link" href="#proof">
            Results
          </a>
          <a className="cs-nav__link" href="#about">
            About
          </a>
          <a className="cs-btn" href={site.links.score}>
            <span className="cs-nav__cta-long">Get your BOSS Score</span>
            <span className="cs-nav__cta-short">BOSS Score</span>
          </a>
        </nav>
        {children}
      </div>
    </header>
  );
}

export type { CoachSiteSource };
