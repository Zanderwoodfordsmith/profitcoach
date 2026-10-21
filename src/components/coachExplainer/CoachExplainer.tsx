import { Fragment, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import {
  back,
  coach as coachCopy,
  cover,
  FOOT,
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
  type ExplainerLength,
  type TimelineRow,
} from "@/lib/coachExplainer/copy";
import type { ExplainerCoach } from "@/lib/coachExplainer/fromBlueprint";
import "./explainer.css";

/**
 * A coach's before-our-call explainer: fixed A4 sheets in the same design
 * system as BCA's before-your-call brochure (Figtree, two-weight headlines,
 * hairlines), filled from the coach's Blueprint. The three phases are the three
 * BOSS pillars and keep the brochure's blue, sky and teal. Print to PDF from
 * the browser; the price sheet only appears when showFee is on.
 */

type Props = {
  coach: ExplainerCoach;
  length: ExplainerLength;
  showFee: boolean;
  origin: string;
  /** SVG markup for a QR code to the coach's BOSS Score page. */
  qrSvg: string | null;
};

type Tone = "blue" | "sky" | "teal";
const TONES: Tone[] = ["blue", "sky", "teal"];

/** One sheet; `title` puts it in the contents list. */
type SheetDef = { key: string; title?: string; render: (page: number) => ReactNode };

export function CoachExplainer({ coach, length, showFee, origin, qrSvg }: Props) {
  const site = coach.site;
  const scoreLink = `${origin.replace(/^https?:\/\//, "")}${site.links.score}`;
  const footName = site.name;

  const sheets: SheetDef[] = [
    { key: "cover", render: () => <Cover coach={coach} /> },
    { key: "welcome", render: (page) => <Welcome page={page} foot={footName} showFee={showFee} contents={contents} /> },
    { key: "now", title: "Where you are now", render: (page) => <WhereYouAre page={page} foot={footName} coach={coach} /> },
    { key: "score", title: "Data before advice", render: (page) => <Score page={page} foot={footName} /> },
    { key: "how", title: "How it works", render: (page) => <HowItWorks page={page} foot={footName} length={length} /> },
    { key: "p1", render: (page) => <PhaseOne page={page} foot={footName} /> },
    { key: "p2", render: (page) => <PhaseTwo page={page} foot={footName} coach={coach} /> },
    { key: "p3", render: (page) => <PhaseThree page={page} foot={footName} length={length} /> },
    { key: "coach", title: "Who you’ll work with", render: (page) => <Coach page={page} foot={footName} coach={coach} /> },
    ...(showFee && coach.fee
      ? [{ key: "price", title: "Your investment", render: (page: number) => <Investment page={page} foot={footName} coach={coach} length={length} /> }]
      : []),
    {
      key: "faq",
      title: "Your questions",
      render: (page) => <Questions page={page} foot={footName} coach={coach} length={length} showFee={showFee} />,
    },
    { key: "call", title: "Before our call", render: (page) => <YourCall page={page} foot={footName} scoreLink={scoreLink} /> },
    { key: "back", render: () => <BackCover coach={coach} scoreLink={scoreLink} qrSvg={qrSvg} /> },
  ];

  const contents = sheets.flatMap((sheet, i) => (sheet.title ? [{ title: sheet.title, page: i + 1 }] : []));

  return (
    <main className="cx">
      {sheets.map((sheet, i) => (
        <Fragment key={sheet.key}>{sheet.render(i + 1)}</Fragment>
      ))}
    </main>
  );
}

/* ---------- shared pieces ---------- */

function Sheet({
  page,
  foot,
  tone,
  className,
  children,
}: {
  page: number;
  foot: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`cx-sheet${tone ? ` cx-tone--${tone}` : ""}${className ? ` ${className}` : ""}`}>
      <div className="cx-sheet__bar" />
      <div className="cx-sheet__body">{children}</div>
      <Foot page={page} name={foot} />
    </section>
  );
}

function Foot({ page, name, light }: { page: number; name: string; light?: boolean }) {
  return (
    <footer className={`cx-foot${light ? " cx-foot--light" : ""}`}>
      <span>
        {name} <i>{FOOT}</i>
      </span>
      <span>{String(page).padStart(2, "0")}</span>
    </footer>
  );
}

function Title({ label, light, bold, size }: { label?: string; light: string; bold: string; size?: "lg" }) {
  return (
    <header className="cx-head">
      {label ? <p className="cx-label">{label}</p> : null}
      <h2 className={`cx-title${size ? ` cx-title--${size}` : ""}`}>
        <span>{light}</span>
        <strong>{bold}</strong>
      </h2>
    </header>
  );
}

function PhaseHead({ n }: { n: number }) {
  const phase = PHASES[n - 1];
  const heading = [phaseOne.heading, phaseTwo.heading, phaseThree("ongoing").heading][n - 1];
  return (
    <header className="cx-head">
      <p className="cx-label">
        Phase {phase.n} <span>{phase.pillar}</span>
      </p>
      <h2 className="cx-h2">{heading}</h2>
    </header>
  );
}

function OnYou({ text }: { text: string }) {
  return (
    <p className="cx-onyou">
      <span>On you</span>
      <strong>{text}</strong>
    </p>
  );
}

function Brand({ light }: { light?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed print sheet, not a layout image.
    <img
      className="cx-logo"
      src={light ? "/brand/profit-coach-logo-white.svg" : "/profit-coach-logo.svg"}
      alt="The Profit Coach"
    />
  );
}

function Portrait({ coach, className }: { coach: ExplainerCoach; className: string }) {
  const photo = coach.site.photo;
  if (!photo) {
    return (
      <span className={`${className} cx-portrait--empty`} aria-hidden="true">
        {coach.site.firstName.slice(0, 1)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- coach photos come from storage.
  return <img className={className} src={photo.src} alt={photo.alt} />;
}

function Checks({ items, two }: { items: string[]; two?: boolean }) {
  return (
    <ul className={`cx-checks${two ? " cx-checks--two" : ""}`}>
      {items.map((line) => (
        <li key={line}>
          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Cover ---------- */

function Cover({ coach }: { coach: ExplainerCoach }) {
  const site = coach.site;
  const stats = coach.facts.length >= 2 ? coach.facts.slice(0, 3) : cover.fallbackStats;
  return (
    <section className="cx-cover">
      <div className="cx-cover__top">
        <Brand light />
        <span>{cover.kicker}</span>
      </div>
      <div className="cx-cover__text">
        <h1 className="cx-cover__title">
          <span>{cover.light}</span>
          <strong>{cover.bold}</strong>
        </h1>
        <hr className="cx-rule cx-rule--light" />
        <p className="cx-cover__standfirst">
          {site.shortLine ?? cover.fallbackStandfirst} {cover.together}
        </p>
      </div>
      <div className="cx-cover__coach">
        <Portrait coach={coach} className="cx-cover__portrait" />
        <div>
          <p className="cx-cover__name">{site.name}</p>
          <p className="cx-cover__role">
            {coachCopy.role}
            {site.place ? ` · ${site.place.label}` : ""}
          </p>
          {site.offer?.name ? <p className="cx-cover__offer">{site.offer.name}</p> : null}
        </div>
      </div>
      <dl className="cx-cover__stats">
        {stats.map((stat) => (
          <div key={stat.value + stat.label}>
            <dd>{stat.value}</dd>
            <dt>{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------- Welcome ---------- */

function Welcome({
  page,
  foot,
  showFee,
  contents,
}: {
  page: number;
  foot: string;
  showFee: boolean;
  contents: { title: string; page: number }[];
}) {
  const w = welcome(showFee);
  return (
    <Sheet page={page} foot={foot}>
      <Title label={w.label} light={w.light} bold={w.bold} size="lg" />
      <p className="cx-lead cx-lead--lg">{w.lead}</p>

      <h3 className="cx-h4 cx-gap">{w.outcomesHeading}</h3>
      <ol className="cx-outcomes">
        {w.outcomes.map((item, i) => (
          <li key={item.title}>
            <span className="cx-outcomes__n">{i + 1}</span>
            <p>
              <strong>{item.title}</strong>
              {item.text}
            </p>
          </li>
        ))}
      </ol>

      <div className="cx-oneline">
        <p>{w.oneLineHeading}</p>
        <ol>
          {PHASES.map((phase, i) => (
            <li key={phase.n}>
              <span>{phase.n}</span>
              {phase.name}
              {i < PHASES.length - 1 ? <ArrowRight size={16} strokeWidth={2} aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="cx-contents">
        <p className="cx-contents__head">
          <strong>Inside</strong>
          <span>{w.readTime}</span>
        </p>
        <ol>
          {contents.map((c, i) => (
            <li key={c.title}>
              <span className="cx-contents__n">{String(i + 1).padStart(2, "0")}</span>
              <span className="cx-contents__t">{c.title}</span>
              <span className="cx-contents__p">{String(c.page).padStart(2, "0")}</span>
            </li>
          ))}
        </ol>
      </div>
    </Sheet>
  );
}

/* ---------- 01 Where you are now ---------- */

function WhereYouAre({ page, foot, coach }: { page: number; foot: string; coach: ExplainerCoach }) {
  const site = coach.site;
  const pains = site.ownerWords.length >= 3 ? site.ownerWords.slice(0, 3) : now.fallbackPains;
  const gap = site.gap.slice(0, 4);
  return (
    <Sheet page={page} foot={foot} className="cx-sheet--tight">
      <Title label={now.label} light={now.light} bold={now.bold} />
      <p className="cx-lead">{now.lead}</p>
      <ol className="cx-pains">
        {pains.map((pain, i) => (
          <li key={pain}>
            <span>{i + 1}</span>
            <p>{pain}</p>
          </li>
        ))}
      </ol>
      <p className="cx-cost">{now.cost}</p>

      <h3 className="cx-h4 cx-gap">{now.tableHeading}</h3>
      {gap.length >= 2 ? (
        <table className="cx-vs cx-vs--two">
          <thead>
            <tr>
              <th>{now.gapColumns[0]}</th>
              <th>{now.gapColumns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {gap.map((row) => (
              <tr key={row.today}>
                <td>{row.today}</td>
                <td>
                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                  {row.want}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="cx-vs">
          <thead>
            <tr>
              <th />
              <th>Today</th>
              <th>With {site.firstName}</th>
            </tr>
          </thead>
          <tbody>
            {now.fallbackRows.map(([label, before, after]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{before}</td>
                <td>
                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                  {after}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="cx-h4 cx-gap">{now.levelsHeading}</h3>
      <Levels />
      <p className="cx-small">{now.levelsNote}</p>
    </Sheet>
  );
}

function Levels() {
  return (
    <ol className="cx-levels">
      {LEVELS.map((level, i) => (
        <li key={level.name} style={{ ["--lv" as string]: level.color }}>
          <span className="cx-levels__bar" style={{ height: `${8 + i * 4}mm` }} />
          <b>
            {i + 1} {level.name}
          </b>
          <span className="cx-levels__text">{level.text}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- 02 Data before advice (dark) ---------- */

function Score({ page, foot }: { page: number; foot: string }) {
  return (
    <section className="cx-dark">
      <div className="cx-dark__body">
        <Title label={score.label} light={score.light} bold={score.bold} size="lg" />
        <p className="cx-lead">{score.lead}</p>

        <dl className="cx-scorestats">
          {score.stats.map((stat) => (
            <div key={stat.text}>
              <dd>{stat.value}</dd>
              <dt>{stat.text}</dt>
            </div>
          ))}
        </dl>

        <div className="cx-pillars">
          <div className="cx-pillars__foundation">
            <strong>{score.foundation.name}</strong>
            <span>{score.foundation.text}</span>
          </div>
          {score.pillars.map((pillar, i) => (
            <div key={pillar.name} className={`cx-pillars__col cx-tone--${TONES[i]}`}>
              <p className="cx-pillars__name">
                <span>Phase {i + 1}</span>
                {pillar.name}
              </p>
              <p className="cx-pillars__text">{pillar.text}</p>
              <ul>
                {pillar.areas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="cx-why__close">
          <p>{score.close}</p>
          <strong>{score.line}</strong>
        </div>
      </div>
      <Foot page={page} name={foot} light />
    </section>
  );
}

/* ---------- 03 How it works ---------- */

function HowItWorks({ page, foot, length }: { page: number; foot: string; length: ExplainerLength }) {
  const t = timing(length);
  return (
    <Sheet page={page} foot={foot}>
      <Title label={how.label} light={how.light} bold={how.bold} />
      <p className="cx-lead">{how.lead}</p>

      <ol className="cx-phases">
        {PHASES.map((phase, i) => (
          <li key={phase.n} className={`cx-tone--${TONES[i]}`}>
            <span className="cx-phases__band">
              <b>Phase {phase.n}</b>
              <i>{t.when[i]}</i>
            </span>
            <div className="cx-phases__body">
              <p className="cx-phases__pillar">{phase.pillar}</p>
              <h3>{phase.name}</h3>
              <p>{phase.text}</p>
              <p className="cx-phases__you">
                <span>On you</span> {phase.you}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <h3 className="cx-h4 cx-gap">{t.heading}</h3>
      <Timeline columns={t.columns} rows={t.rows} />
      <p className="cx-small">{how.note}</p>
    </Sheet>
  );
}

function Timeline({ columns, rows }: { columns: string[]; rows: TimelineRow[] }) {
  const grid = { gridTemplateColumns: `56mm repeat(${columns.length}, minmax(0, 1fr))` };
  return (
    <div className="cx-gantt">
      <div className="cx-gantt__row cx-gantt__row--head" style={grid}>
        <span />
        {columns.map((m) => (
          <span key={m} className="cx-gantt__month">
            {m}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.label} className="cx-gantt__row" style={grid}>
          <span className="cx-gantt__label">{row.label}</span>
          <span
            className={`cx-gantt__bar cx-gantt__bar--${row.tone}${row.on ? " cx-gantt__bar--on" : ""}`}
            style={{ gridColumn: `${row.start + 2} / ${row.end + 3}` }}
          >
            {row.note ? <em>{row.note}</em> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Phase 1: Vision ---------- */

function PhaseOne({ page, foot }: { page: number; foot: string }) {
  return (
    <Sheet page={page} foot={foot} tone="blue">
      <PhaseHead n={1} />
      <p className="cx-lead">{phaseOne.lead}</p>

      <ol className="cx-builds">
        {phaseOne.sessions.map((item, i) => (
          <li key={item.title}>
            <span>Session {i + 1}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </li>
        ))}
      </ol>

      <h3 className="cx-h4 cx-gap">{phaseOne.systemHeading}</h3>
      <div className="cx-system">
        <ol>
          {phaseOne.system.map((node, i) => (
            <li key={node}>
              <span>{node}</span>
              {i < phaseOne.system.length - 1 ? <ArrowRight size={16} strokeWidth={2} aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
        <p>{phaseOne.systemNote}</p>
      </div>

      <div className="cx-phase-end">
        <OnYou text={PHASES[0].you} />
        <p className="cx-result">{phaseOne.result}</p>
      </div>
    </Sheet>
  );
}

/* ---------- Phase 2: Velocity ---------- */

function PhaseTwo({ page, foot, coach }: { page: number; foot: string; coach: ExplainerCoach }) {
  return (
    <Sheet page={page} foot={foot} tone="sky">
      <PhaseHead n={2} />
      <p className="cx-lead">{phaseTwo.lead}</p>

      <div className="cx-us cx-gap">
        {phaseTwo.areas.map((area) => (
          <div key={area.name} className="cx-us__col">
            <p className="cx-us__phase">{area.name}</p>
            <ul>
              {area.items.map((item) => (
                <li key={item}>
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {coach.helpWith.length ? (
        <>
          <h3 className="cx-h4 cx-gap">{phaseTwo.coachHeading(coach.site.firstName)}</h3>
          <Checks items={coach.helpWith} two />
        </>
      ) : null}

      <div className="cx-multiply">
        <div>
          <h3>{phaseTwo.multiplierHeading}</h3>
          <p>{phaseTwo.multiplierText}</p>
        </div>
        <p className="cx-multiply__sum" aria-label="1.1 to the power of 5 is 1.61">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i}>
              1.1{i < 4 ? <i>×</i> : null}
            </span>
          ))}
          <i>=</i>
          <strong>1.61</strong>
        </p>
        <p className="cx-multiply__result">{phaseTwo.multiplierResult}</p>
      </div>
      <p className="cx-small">{phaseTwo.multiplierNote}</p>

      <div className="cx-playbooks">
        <div>
          <h3>{phaseTwo.playbooksHeading}</h3>
          <p>{phaseTwo.playbooksText}</p>
        </div>
        <ul>
          {phaseTwo.playbooks.map((book) => (
            <li key={book.name} style={{ ["--lv" as string]: LEVELS[book.level - 1].color }}>
              <span>Level {book.level}</span>
              {book.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="cx-phase-end">
        <OnYou text={PHASES[1].you} />
        <p className="cx-result">{phaseTwo.result}</p>
      </div>
    </Sheet>
  );
}

/* ---------- Phase 3: Value ---------- */

function PhaseThree({ page, foot, length }: { page: number; foot: string; length: ExplainerLength }) {
  const p = phaseThree(length);
  return (
    <Sheet page={page} foot={foot} tone="teal">
      <PhaseHead n={3} />
      <p className="cx-lead">{p.lead}</p>

      <div className="cx-us cx-gap">
        {p.areas.map((area) => (
          <div key={area.name} className="cx-us__col">
            <p className="cx-us__phase">{area.name}</p>
            <ul>
              {area.items.map((item) => (
                <li key={item}>
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="cx-journey">
        <p className="cx-journey__head">{now.levelsHeading}</p>
        <ol className="cx-climb">
          {LEVELS.map((level, i) => (
            <li key={level.name} style={{ ["--lv" as string]: level.color }}>
              <b>{i + 1}</b>
              {level.name}
            </li>
          ))}
        </ol>
      </div>

      <h3 className="cx-h4 cx-gap">{p.keepHeading}</h3>
      <Checks items={p.keep} />

      <div className="cx-phase-end">
        <OnYou text={PHASES[2].you} />
        <p className="cx-result">{p.stay}</p>
      </div>
    </Sheet>
  );
}

/* ---------- 04 Who you'll work with ---------- */

function Coach({ page, foot, coach }: { page: number; foot: string; coach: ExplainerCoach }) {
  const site = coach.site;
  const about = site.bio ?? site.intro;
  const quote = site.testimonials[0];
  return (
    <Sheet page={page} foot={foot}>
      <Title label={coachCopy.label} light={coachCopy.light} bold={site.name} />

      <div className="cx-coach">
        <Portrait coach={coach} className="cx-coach__photo" />
        <div>
          <p className="cx-coach__role">
            {coachCopy.role}
            {site.place ? ` · ${site.place.label}` : ""}
          </p>
          {about ? <p className="cx-coach__bio">{about}</p> : null}
        </div>
      </div>

      {coach.facts.length ? (
        <dl className="cx-tiles cx-gap">
          {coach.facts.slice(0, 3).map((fact) => (
            <div key={fact.value + fact.label}>
              <dd>{fact.value}</dd>
              <dt>{fact.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}

      {quote ? (
        <figure className="cx-quote">
          <blockquote>&ldquo;{quote.quote}&rdquo;</blockquote>
          <figcaption>{quote.cite}</figcaption>
        </figure>
      ) : null}

      {site.whyMe.length ? (
        <>
          <h3 className="cx-h4 cx-gap">{coachCopy.whyHeading(site.firstName)}</h3>
          {/* The first "why you" line usually repeats the headline result already in the bio and facts. */}
          <Checks items={site.whyMe.slice(site.whyMe.length > 3 ? 1 : 0, 4)} />
        </>
      ) : !coach.facts.length && site.results.length ? (
        <>
          <h3 className="cx-h4 cx-gap">Results</h3>
          <Checks items={site.results.slice(0, 3)} />
        </>
      ) : null}

      <div className="cx-trust">
        <h3>
          {coachCopy.systemHeading}
          <span>{coachCopy.systemName}</span>
        </h3>
        <p>{coachCopy.systemText}</p>
      </div>
    </Sheet>
  );
}

/* ---------- Your investment (dark, only with the fee on) ---------- */

function Investment({
  page,
  foot,
  coach,
  length,
}: {
  page: number;
  foot: string;
  coach: ExplainerCoach;
  length: ExplainerLength;
}) {
  const inv = investment(length);
  return (
    <section className="cx-dark cx-dark--price">
      <div className="cx-dark__body">
        <p className="cx-label">{inv.label}</p>
        {coach.price ? (
          <h2 className="cx-price">
            <strong>{coach.price.amount}</strong>
            <span>{coach.price.unit}</span>
          </h2>
        ) : (
          <h2 className="cx-price cx-price--text">
            <strong>{coach.fee}</strong>
          </h2>
        )}
        <p className="cx-price__then">{coach.paymentTerms ?? inv.then}</p>

        {coach.price ? (
          <div className="cx-schedule">
            <p>{inv.scheduleHeading}</p>
            <ol>
              {inv.months.map((month) => (
                <li key={month}>
                  <span>{month}</span>
                  <strong>{coach.price!.amount}</strong>
                </li>
              ))}
              <li className="is-last">
                <span>{inv.last.when}</span>
                <strong>{inv.last.what}</strong>
              </li>
            </ol>
          </div>
        ) : null}

        <div className="cx-included">
          <p>{inv.includedHeading}</p>
          <ul>
            {inv.included.map((line) => (
              <li key={line}>
                <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <dl className="cx-facts">
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
        </dl>

        {coach.guarantee ? (
          <div className="cx-guarantee cx-guarantee--plain">
            <div>
              <p className="cx-guarantee__name">If it isn’t right</p>
              <p>{coach.guarantee}</p>
            </div>
          </div>
        ) : null}
      </div>
      <Foot page={page} name={foot} light />
    </section>
  );
}

/* ---------- 05 Questions ---------- */

function Questions({
  page,
  foot,
  coach,
  length,
  showFee,
}: {
  page: number;
  foot: string;
  coach: ExplainerCoach;
  length: ExplainerLength;
  showFee: boolean;
}) {
  const q = questions({
    length,
    showFee,
    fee: coach.fee,
    rhythm: coach.rhythm,
    guarantee: coach.guarantee,
    whoIHelp: coach.site.whoIHelp,
  });
  return (
    <Sheet page={page} foot={foot}>
      <p className="cx-label">{q.label}</p>
      <h2 className="cx-h2">{q.heading}</h2>
      <dl className="cx-faq">
        {q.items.map((item) => (
          <div key={item.q}>
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}

/* ---------- 06 Before our call ---------- */

function YourCall({ page, foot, scoreLink }: { page: number; foot: string; scoreLink: string }) {
  return (
    <Sheet page={page} foot={foot}>
      <p className="cx-label">{yourCall.label}</p>
      <h2 className="cx-h2">{yourCall.heading}</h2>

      <div className="cx-call">
        <p className="cx-call__bring">{yourCall.bringHeading}</p>
        <ol className="cx-bring">
          {yourCall.bring(scoreLink).map((b, i) => (
            <li key={b.title}>
              <span>{i + 1}</span>
              <p>
                <strong>{b.title}</strong>
                {b.text}
              </p>
            </li>
          ))}
        </ol>
        <p className="cx-small">{yourCall.practical}</p>
      </div>

      <h3 className="cx-h4 cx-gap">{yourCall.nextHeading}</h3>
      <ol className="cx-next">
        {yourCall.next.map((step, i) => (
          <li key={step.title}>
            <span>{i + 1}</span>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

/* ---------- Back cover (dark) ---------- */

function BackCover({ coach, scoreLink, qrSvg }: { coach: ExplainerCoach; scoreLink: string; qrSvg: string | null }) {
  const site = coach.site;
  const links = [
    qrSvg ? null : { label: back.scoreLabel, text: scoreLink, href: `https://${scoreLink}` },
    coach.website
      ? { label: back.websiteLabel, text: coach.website.replace(/^https?:\/\//, ""), href: coach.website }
      : site.linkedinUrl
        ? { label: back.linkedinLabel, text: site.linkedinUrl.replace(/^https?:\/\/(www\.)?/, ""), href: site.linkedinUrl }
        : null,
  ].filter((link): link is { label: string; text: string; href: string } => Boolean(link));
  return (
    <section className="cx-dark cx-back">
      <Brand light />
      {qrSvg ? (
        <div className="cx-back__qr">
          {/* Generated server-side by the qrcode package from the coach's own score link. */}
          <span className="cx-back__code" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div>
            <h3>{back.qrHeading}</h3>
            <p>{back.qrText}</p>
            <p className="cx-back__url">{scoreLink}</p>
          </div>
        </div>
      ) : null}
      <div className="cx-back__body">
        <div className="cx-back__who">
          <Portrait coach={coach} className="cx-back__portrait" />
          <p>
            <strong>{site.name}</strong>
            {coachCopy.role}
          </p>
        </div>
        <h2>{back.heading}</h2>
        <ol className="cx-back__recap">
          {PHASES.map((phase) => (
            <li key={phase.n}>
              <span>
                Phase {phase.n} · {phase.pillar}
              </span>
              <p>{phase.text}</p>
            </li>
          ))}
        </ol>
        <p className="cx-back__close">{back.close}</p>
        <div className="cx-back__links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              <strong>{l.label}</strong>
              <span>{l.text}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
