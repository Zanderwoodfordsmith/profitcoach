import type { ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, FileDown } from "lucide-react";
import {
  back,
  coach as coachCopy,
  cover,
  EXPLAINER_CALLS,
  how,
  investment,
  LEVELS,
  now,
  PHASES,
  phaseOne,
  phaseThree,
  phaseTwo,
  questions,
  score,
  timing,
  welcome,
  yourCall,
  type ExplainerCall,
  type ExplainerLength,
} from "@/lib/coachExplainer/copy";
import type { ExplainerCoach } from "@/lib/coachExplainer/fromBlueprint";
import { ExplainerDigitalNav, type DigitalNavItem } from "./ExplainerDigitalNav";
import "./explainerDigital.css";

/**
 * The digital explainer: the same words as the A4 brochure (copy.ts plus the
 * coach's Blueprint), laid out to read on a screen with a side menu. Two
 * versions: before the BOSS Score Review (short, no price) and before the
 * Profit Roadmap call (the phase detail and the price). "Save as PDF" prints
 * the matching A4 version, so the words live in one place.
 */

type Props = {
  coach: ExplainerCoach;
  call: ExplainerCall;
  length: ExplainerLength;
  origin: string;
  pdfHref: string;
};

const TONES = ["blue", "sky", "teal"] as const;

export function CoachExplainerDigital({ coach, call, length, origin, pdfHref }: Props) {
  const site = coach.site;
  const roadmap = call === "roadmap";
  const showFee = roadmap && Boolean(coach.fee);
  const w = welcome(showFee, call);
  const scoreLink = `${origin}${site.links.score}`;

  const nav: DigitalNavItem[] = [
    { id: "plan", title: "The plan" },
    { id: "now", title: "Where you are now" },
    { id: "score", title: "Your BOSS Score" },
    { id: "how", title: "How it works" },
    ...(roadmap
      ? PHASES.map((p) => ({ id: `phase-${p.n}`, title: `Phase ${p.n}: ${p.name}`, sub: true }))
      : []),
    { id: "coach", title: `About ${site.firstName}` },
    ...(showFee ? [{ id: "investment", title: "Your investment" }] : []),
    { id: "questions", title: "Your questions" },
    { id: "call", title: roadmap ? "Before our next call" : "Before our call" },
  ];

  return (
    <div className="cxd">
      <Hero coach={coach} call={call} />
      <div className="cxd-layout">
        <ExplainerDigitalNav
          items={nav}
          coachName={site.name}
          actions={
            <>
              <a className="cxd-btn cxd-btn--solid" href={site.links.score}>
                Take your BOSS Score
                <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
              </a>
              <a className="cxd-btn cxd-btn--quiet" href={pdfHref} target="_blank" rel="noopener">
                <FileDown size={16} strokeWidth={2} aria-hidden="true" />
                Save as PDF
              </a>
            </>
          }
        />
        <main className="cxd-main">
          <Section id="plan" light={w.light} bold={w.bold}>
            <p className="cxd-lead">{w.lead}</p>
            <h3 className="cxd-h3">{w.outcomesHeading}</h3>
            <ol className="cxd-steps">
              {w.outcomes.map((o, i) => (
                <li key={o.title}>
                  <span className="cxd-steps__n">{i + 1}</span>
                  <div>
                    <p className="cxd-steps__title">{o.title}</p>
                    <p>{o.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <h3 className="cxd-h3">{w.oneLineHeading}</h3>
            <PhaseLine />
          </Section>

          <WhereYouAre coach={coach} />
          <Score />
          <HowItWorks length={length} />
          {roadmap ? (
            <>
              <PhaseOne />
              <PhaseTwo coach={coach} />
              <PhaseThree length={length} />
            </>
          ) : null}
          <AboutCoach coach={coach} />
          {showFee ? <Investment coach={coach} length={length} /> : null}
          <Questions coach={coach} length={length} showFee={showFee} call={call} />
          <YourCall roadmap={roadmap} scoreLink={scoreLink} scoreHref={site.links.score} />
        </main>
      </div>
      <Close coach={coach} roadmap={roadmap} scoreHref={site.links.score} pdfHref={pdfHref} />
    </div>
  );
}

/* ---------- shared pieces ---------- */

function Section({
  id,
  light,
  bold,
  tone,
  children,
}: {
  id: string;
  light?: string;
  bold: string;
  tone?: (typeof TONES)[number];
  children: ReactNode;
}) {
  return (
    <section id={id} className={`cxd-section${tone ? ` cxd-tone--${tone}` : ""}`} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="cxd-h2">
        {light ? <span>{light}</span> : null}
        <strong>{bold}</strong>
      </h2>
      {children}
    </section>
  );
}

function Checks({ items, two }: { items: string[]; two?: boolean }) {
  return (
    <ul className={`cxd-checks${two ? " cxd-checks--two" : ""}`}>
      {items.map((line) => (
        <li key={line}>
          <Check size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function Portrait({ coach, className }: { coach: ExplainerCoach; className: string }) {
  const photo = coach.site.photo;
  if (!photo) {
    return (
      <span className={`${className} cxd-portrait--empty`} aria-hidden="true">
        {coach.site.firstName.slice(0, 1)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- coach photos come from storage.
  return <img className={className} src={photo.src} alt={photo.alt} />;
}

function PhaseLine() {
  return (
    <ol className="cxd-phaseline">
      {PHASES.map((p, i) => (
        <li key={p.n} className={`cxd-tone--${TONES[i]}`}>
          <span>Phase {p.n}</span>
          <strong>{p.name}</strong>
        </li>
      ))}
    </ol>
  );
}

function OnYou({ text }: { text: string }) {
  return (
    <p className="cxd-onyou">
      <span>Your part</span>
      {text}
    </p>
  );
}

/* ---------- Hero ---------- */

function Hero({ coach, call }: { coach: ExplainerCoach; call: ExplainerCall }) {
  const site = coach.site;
  const kicker = EXPLAINER_CALLS.find((c) => c.value === call)?.kicker ?? cover.kicker;
  const stats = coach.facts.length >= 2 ? coach.facts.slice(0, 3) : cover.fallbackStats;
  return (
    <header className="cxd-hero">
      <div className="cxd-hero__inner">
        <div className="cxd-hero__top">
          {/* eslint-disable-next-line @next/next/no-img-element -- small SVG logo. */}
          <img className="cxd-logo" src="/brand/profit-coach-logo-white.svg" alt="The Profit Coach" />
          <p>{kicker}</p>
        </div>
        <div className="cxd-hero__grid">
          <div>
            <h1 className="cxd-hero__title">
              <span>{cover.light}</span>
              <strong>{cover.bold}</strong>
            </h1>
            <p className="cxd-hero__standfirst">
              {site.shortLine ?? cover.fallbackStandfirst} {cover.together}
            </p>
          </div>
          <div className="cxd-hero__coach">
            <Portrait coach={coach} className="cxd-hero__portrait" />
            <div>
              <p className="cxd-hero__name">{site.name}</p>
              <p className="cxd-hero__role">
                {coachCopy.role}
                {site.place ? ` · ${site.place.label}` : ""}
              </p>
            </div>
          </div>
        </div>
        <dl className="cxd-hero__stats">
          {stats.map((stat) => (
            <div key={stat.value + stat.label}>
              <dd>{stat.value}</dd>
              <dt>{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

/* ---------- Where you are now ---------- */

function WhereYouAre({ coach }: { coach: ExplainerCoach }) {
  const site = coach.site;
  const pains = site.ownerWords.length >= 3 ? site.ownerWords.slice(0, 3) : now.fallbackPains;
  const gap = site.gap.slice(0, 4);
  const rows: [string, string][] =
    gap.length >= 2 ? gap.map((r) => [r.today, r.want]) : now.fallbackRows.map(([, before, after]) => [before, after]);
  const labels = gap.length >= 2 ? null : now.fallbackRows.map(([label]) => label);
  return (
    <Section id="now" light={now.light} bold={now.bold}>
      <p className="cxd-lead">{now.lead}</p>
      <ol className="cxd-pains">
        {pains.map((pain) => (
          <li key={pain}>{pain}</li>
        ))}
      </ol>
      <p className="cxd-cost">{now.cost}</p>

      <h3 className="cxd-h3">{now.tableHeading}</h3>
      <div className="cxd-vs" role="table" aria-label={now.tableHeading}>
        <div className="cxd-vs__head" role="row">
          <span role="columnheader">{now.gapColumns[0]}</span>
          <span role="columnheader">{labels ? `With ${site.firstName}` : now.gapColumns[1]}</span>
        </div>
        {rows.map(([today, want], i) => (
          <div key={today} className="cxd-vs__row" role="row">
            <span role="cell">
              {labels ? <em>{labels[i]}</em> : null}
              {today}
            </span>
            <span role="cell">
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              {want}
            </span>
          </div>
        ))}
      </div>

      <h3 className="cxd-h3">{now.levelsHeading}</h3>
      <ol className="cxd-levels">
        {LEVELS.map((level, i) => (
          <li key={level.name} style={{ ["--lv" as string]: level.color, ["--h" as string]: `${2 + i * 1.75}rem` }}>
            <span className="cxd-levels__bar" aria-hidden="true" />
            <strong>
              {i + 1}. {level.name}
            </strong>
            <span>{level.text}</span>
          </li>
        ))}
      </ol>
      <p className="cxd-note">{now.levelsNote}</p>
    </Section>
  );
}

/* ---------- Your BOSS Score ---------- */

function Score() {
  return (
    <Section id="score" light={score.light} bold={score.bold}>
      <p className="cxd-lead">{score.lead}</p>
      <dl className="cxd-figures">
        {score.stats.map((s) => (
          <div key={s.text}>
            <dd>{s.value}</dd>
            <dt>{s.text}</dt>
          </div>
        ))}
      </dl>
      <div className="cxd-pillars">
        <p className="cxd-pillars__base">
          <strong>{score.foundation.name}</strong>
          {score.foundation.text}
        </p>
        <div className="cxd-pillars__row">
          {score.pillars.map((pillar, i) => (
            <div key={pillar.name} className={`cxd-pillar cxd-tone--${TONES[i]}`}>
              <p className="cxd-pillar__name">{pillar.name}</p>
              <p className="cxd-pillar__text">{pillar.text}</p>
              <ul>
                {pillar.areas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <p className="cxd-line">
        {score.close} <strong>{score.line}</strong>
      </p>
    </Section>
  );
}

/* ---------- How it works ---------- */

function HowItWorks({ length }: { length: ExplainerLength }) {
  const t = timing(length);
  const cols = t.columns.length;
  return (
    <Section id="how" light={how.light} bold={how.bold}>
      <p className="cxd-lead">{how.lead}</p>
      <ol className="cxd-phases">
        {PHASES.map((p, i) => (
          <li key={p.n} className={`cxd-tone--${TONES[i]}`}>
            <p className="cxd-phases__head">
              <span>
                Phase {p.n} · {p.pillar}
              </span>
              <em>{t.when[i]}</em>
            </p>
            <p className="cxd-phases__name">{p.name}</p>
            <p>{p.text}</p>
            <p className="cxd-phases__you">
              <span>Your part</span>
              {p.you}
            </p>
          </li>
        ))}
      </ol>

      <h3 className="cxd-h3">{t.heading}</h3>
      <div className="cxd-timeline" style={{ ["--cols" as string]: cols }}>
        <div className="cxd-timeline__cols" aria-hidden="true">
          <span />
          {t.columns.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        {t.rows.map((row) => (
          <div key={row.label} className="cxd-timeline__row">
            <span className="cxd-timeline__label">{row.label}</span>
            <span className="cxd-timeline__track">
              <span
                className={`cxd-timeline__bar is-${row.tone}${row.on ? " is-on" : ""}`}
                style={{ gridColumn: `${row.start + 1} / ${row.end + 2}` }}
              >
                {row.note ? <em>{row.note}</em> : null}
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="cxd-note">{how.note}</p>
    </Section>
  );
}

function PhaseOne() {
  return (
    <Section id="phase-1" light={`Phase 1: ${PHASES[0].name}`} bold={phaseOne.heading} tone="blue">
      <p className="cxd-lead">{phaseOne.lead}</p>
      <ol className="cxd-steps cxd-steps--grid">
        {phaseOne.sessions.map((s, i) => (
          <li key={s.title}>
            <span className="cxd-steps__n">{i + 1}</span>
            <div>
              <p className="cxd-steps__title">{s.title}</p>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <h3 className="cxd-h3">{phaseOne.systemHeading}</h3>
      <ol className="cxd-chain">
        {phaseOne.system.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <p className="cxd-note">{phaseOne.systemNote}</p>
      <PhaseEnd you={PHASES[0].you} result={phaseOne.result} />
    </Section>
  );
}

function PhaseTwo({ coach }: { coach: ExplainerCoach }) {
  return (
    <Section id="phase-2" light={`Phase 2: ${PHASES[1].name}`} bold={phaseTwo.heading} tone="sky">
      <p className="cxd-lead">{phaseTwo.lead}</p>
      <Areas areas={phaseTwo.areas} />
      {coach.helpWith.length ? (
        <>
          <h3 className="cxd-h3">{phaseTwo.coachHeading(coach.site.firstName)}</h3>
          <Checks items={coach.helpWith} two />
        </>
      ) : null}
      <div className="cxd-multiply">
        <div>
          <h3 className="cxd-h3">{phaseTwo.multiplierHeading}</h3>
          <p>{phaseTwo.multiplierText}</p>
        </div>
        <p className="cxd-multiply__sum" aria-label="1.1 to the power of 5 is 1.61">
          <span aria-hidden="true">1.1 × 1.1 × 1.1 × 1.1 × 1.1 =</span>
          <strong>1.61</strong>
          <em>{phaseTwo.multiplierResult}</em>
        </p>
      </div>
      <p className="cxd-note">{phaseTwo.multiplierNote}</p>
      <h3 className="cxd-h3">{phaseTwo.playbooksHeading}</h3>
      <p>{phaseTwo.playbooksText}</p>
      <ul className="cxd-books">
        {phaseTwo.playbooks.map((book) => (
          <li key={book.name} style={{ ["--lv" as string]: LEVELS[book.level - 1].color }}>
            <span>Level {book.level}</span>
            {book.name}
          </li>
        ))}
      </ul>
      <PhaseEnd you={PHASES[1].you} result={phaseTwo.result} />
    </Section>
  );
}

function PhaseThree({ length }: { length: ExplainerLength }) {
  const p3 = phaseThree(length);
  return (
    <Section id="phase-3" light={`Phase 3: ${PHASES[2].name}`} bold={p3.heading} tone="teal">
      <p className="cxd-lead">{p3.lead}</p>
      <Areas areas={p3.areas} />
      <h3 className="cxd-h3">{p3.keepHeading}</h3>
      <Checks items={p3.keep} />
      <PhaseEnd you={PHASES[2].you} result={p3.stay} />
    </Section>
  );
}

function Areas({ areas }: { areas: { name: string; items: string[] }[] }) {
  return (
    <div className="cxd-areas">
      {areas.map((area) => (
        <div key={area.name}>
          <p className="cxd-areas__name">{area.name}</p>
          <ul>
            {area.items.map((item) => (
              <li key={item}>
                <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PhaseEnd({ you, result }: { you: string; result: string }) {
  return (
    <div className="cxd-phase-end">
      <OnYou text={you} />
      <p className="cxd-phase-end__result">{result}</p>
    </div>
  );
}

/* ---------- The coach ---------- */

function AboutCoach({ coach }: { coach: ExplainerCoach }) {
  const site = coach.site;
  const about = site.bio ?? site.intro;
  const quote = site.testimonials[0];
  const why = site.whyMe.length ? site.whyMe.slice(site.whyMe.length > 3 ? 1 : 0, 4) : !coach.facts.length ? site.results.slice(0, 3) : [];
  return (
    <Section id="coach" light={coachCopy.light} bold={site.name}>
      <div className="cxd-coach">
        <Portrait coach={coach} className="cxd-coach__photo" />
        <div>
          <p className="cxd-coach__role">
            {coachCopy.role}
            {site.place ? ` · ${site.place.label}` : ""}
          </p>
          {about ? <p className="cxd-coach__bio">{about}</p> : null}
        </div>
      </div>
      {coach.facts.length ? (
        <dl className="cxd-figures cxd-figures--facts">
          {coach.facts.slice(0, 3).map((fact) => (
            <div key={fact.value + fact.label}>
              <dd>{fact.value}</dd>
              <dt>{fact.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      {quote ? (
        <figure className="cxd-quote">
          <blockquote>&ldquo;{quote.quote}&rdquo;</blockquote>
          <figcaption>{quote.cite}</figcaption>
        </figure>
      ) : null}
      {why.length ? (
        <>
          <h3 className="cxd-h3">{site.whyMe.length ? coachCopy.whyHeading(site.firstName) : "Results"}</h3>
          <Checks items={why} />
        </>
      ) : null}
      <p className="cxd-trust">
        <strong>
          {coachCopy.systemHeading}: {coachCopy.systemName}.
        </strong>{" "}
        {coachCopy.systemText}
      </p>
    </Section>
  );
}

/* ---------- Investment (roadmap version, with a fee) ---------- */

function Investment({ coach, length }: { coach: ExplainerCoach; length: ExplainerLength }) {
  const inv = investment(length);
  return (
    <section id="investment" className="cxd-section cxd-invest" aria-labelledby="investment-h">
      <h2 id="investment-h" className="cxd-invest__label">
        {inv.label}
      </h2>
      <p className="cxd-invest__price">
        <strong>{coach.price?.amount ?? coach.fee}</strong>
        {coach.price ? <span>{coach.price.unit}</span> : null}
      </p>
      <p className="cxd-invest__then">{coach.paymentTerms ?? inv.then}</p>
      {coach.price ? (
        <ol className="cxd-invest__schedule" aria-label={inv.scheduleHeading}>
          {inv.months.map((month) => (
            <li key={month}>
              <span>{month}</span>
              <strong>{coach.price!.amount}</strong>
            </li>
          ))}
          <li>
            <span>{inv.last.when}</span>
            <strong>{inv.last.what}</strong>
          </li>
        </ol>
      ) : null}
      <div className="cxd-invest__grid">
        <div>
          <p className="cxd-invest__h">{inv.includedHeading}</p>
          <Checks items={inv.included} />
        </div>
        <dl>
          {coach.rhythm ?? coach.site.offer?.included ? (
            <div>
              <dt>{inv.rhythmHeading}</dt>
              <dd>{coach.rhythm ?? coach.site.offer?.included}</dd>
            </div>
          ) : null}
          <div>
            <dt>{inv.paidHeading}</dt>
            <dd>{inv.paid}</dd>
          </div>
          {coach.guarantee ? (
            <div>
              <dt>If it isn’t right</dt>
              <dd>{coach.guarantee}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}

/* ---------- Questions ---------- */

function Questions({
  coach,
  length,
  showFee,
  call,
}: {
  coach: ExplainerCoach;
  length: ExplainerLength;
  showFee: boolean;
  call: ExplainerCall;
}) {
  const q = questions({
    length,
    showFee,
    fee: coach.fee,
    rhythm: coach.rhythm,
    guarantee: coach.guarantee,
    whoIHelp: coach.site.whoIHelp,
    call,
  });
  return (
    <Section id="questions" bold={q.heading}>
      <div className="cxd-faq">
        {q.items.map((item, i) => (
          <details key={item.q} open={i === 0}>
            <summary>
              {item.q}
              <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ---------- Before our call ---------- */

function YourCall({ roadmap, scoreLink, scoreHref }: { roadmap: boolean; scoreLink: string; scoreHref: string }) {
  const bring = yourCall.bring(scoreLink.replace(/^https?:\/\//, ""));
  return (
    <Section id="call" bold={roadmap ? "How to get the most from our next call" : yourCall.heading}>
      <h3 className="cxd-h3">{yourCall.bringHeading}</h3>
      <ul className="cxd-bring">
        {bring.map((b) => (
          <li key={b.title}>
            <p className="cxd-bring__title">{b.title}</p>
            <p>
              {b.title === "Your BOSS Score" ? (
                <>
                  About 3 minutes. <a href={scoreHref}>Take it here</a>.
                </>
              ) : (
                b.text
              )}
            </p>
          </li>
        ))}
      </ul>
      <p className="cxd-note">{yourCall.practical}</p>
      {roadmap ? (
        <>
          <h3 className="cxd-h3">{yourCall.nextHeading}</h3>
          <ol className="cxd-steps">
            {yourCall.next.map((n, i) => (
              <li key={n.title}>
                <span className="cxd-steps__n">{i + 1}</span>
                <div>
                  <p className="cxd-steps__title">{n.title}</p>
                  <p>{n.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </Section>
  );
}

/* ---------- Close ---------- */

function Close({ coach, roadmap, scoreHref, pdfHref }: { coach: ExplainerCoach; roadmap: boolean; scoreHref: string; pdfHref: string }) {
  const site = coach.site;
  return (
    <footer className="cxd-close">
      <div className="cxd-close__inner">
        <div className="cxd-close__who">
          <Portrait coach={coach} className="cxd-close__portrait" />
          <p>
            <strong>{site.name}</strong>
            {coachCopy.role}
          </p>
        </div>
        <h2 className="cxd-close__title">{back.heading}</h2>
        <ol className="cxd-close__recap">
          {PHASES.map((p) => (
            <li key={p.n}>
              <span>
                Phase {p.n} · {p.pillar}
              </span>
              {p.text}
            </li>
          ))}
        </ol>
        <div className="cxd-close__actions">
          {roadmap ? null : (
            <a className="cxd-btn cxd-btn--light" href={scoreHref}>
              Take your BOSS Score
              <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
            </a>
          )}
          <a className="cxd-btn cxd-btn--outline" href={pdfHref} target="_blank" rel="noopener">
            Save as PDF
          </a>
          {site.linkedinUrl ? (
            <a className="cxd-btn cxd-btn--outline" href={site.linkedinUrl} target="_blank" rel="noopener">
              {back.linkedinLabel}
            </a>
          ) : null}
        </div>
        <p className="cxd-close__line">{back.close}</p>
      </div>
    </footer>
  );
}
