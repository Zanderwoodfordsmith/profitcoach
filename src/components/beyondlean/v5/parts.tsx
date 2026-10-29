import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, ArrowUpRight, Phone } from "lucide-react";
import { figtree, instrumentSerif } from "@/fonts";
import { BOOK_HREF, EMAIL, PHONE, SCORE_HREF } from "../BeyondleanSite";
import { PremiumMotion } from "../PremiumMotion";
import "../beyondleanPremium.css";
import "../beyondleanBca.css";
import "../beyondleanV5.css";
import "./pages.css";

export const PHONE_HREF = "tel:+447843577771";
export const HOME = "/beyondlean";

export const NAV = [
  { href: `${HOME}/how-it-works`, label: "How it works", key: "how" },
  { href: `${HOME}/case-studies`, label: "Case studies", key: "cases" },
  { href: `${HOME}/blog`, label: "Blog", key: "blog" },
  { href: `${HOME}/about`, label: "About Paul", key: "about" },
] as const;

export type NavKey = (typeof NAV)[number]["key"] | "home";

export function Wordmark() {
  return (
    <>
      <span className="v5-wm-a">Beyond</span>
      <span className="v5-wm-b">lean</span>
    </>
  );
}

export function CircleButton({
  href,
  children,
  tone = "blue",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "blue" | "white";
}) {
  return (
    <a className={`v5-cbtn v5-cbtn-${tone}`} href={href}>
      <span className="v5-cbtn-ic" aria-hidden>
        <ArrowUpRight />
      </span>
      {children}
    </a>
  );
}

export function Heading({
  id,
  light,
  strong,
  center = false,
  as: Tag = "h2",
}: {
  id?: string;
  light?: string;
  strong: string;
  center?: boolean;
  as?: "h1" | "h2";
}) {
  return (
    <Tag id={id} className={`v5-h2${center ? " is-center" : ""}`}>
      {light && <span>{light}</span>} <strong>{strong}</strong>
    </Tag>
  );
}

function Nav({ active }: { active: NavKey }) {
  return (
    <header className="v5-nav" data-motion-nav>
      <div className="v5-wrap v5-nav-inner">
        <Link className="v5-wordmark" href={HOME} aria-label="Beyondlean home">
          <Wordmark />
        </Link>
        <nav className="v5-nav-pill" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} aria-current={active === n.key ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <a className="v5-phone" href={PHONE_HREF}>
          <span className="v5-phone-ic" aria-hidden>
            <Phone />
          </span>
          <span className="v5-phone-num">{PHONE}</span>
        </a>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="v5-footer">
      <div className="v5-wrap v5-footer-grid">
        <div>
          <span className="v5-wordmark">
            <Wordmark />
          </span>
          <p>
            Business coaching for owner-led UK businesses. 25 years of making work flow, now helping owners get their
            time and profit back.
          </p>
        </div>
        <div>
          <h3>Explore</h3>
          {NAV.map((n) => (
            <Link key={n.key} href={n.href}>
              {n.label}
            </Link>
          ))}
        </div>
        <div>
          <h3>Get started</h3>
          <a href={SCORE_HREF}>Free BOSS Score</a>
          <a href={BOOK_HREF}>Book a value call</a>
        </div>
        <div>
          <h3>Contact</h3>
          <a href={PHONE_HREF}>{PHONE}</a>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <span>North Wales, working UK-wide</span>
          <a href="https://www.linkedin.com/in/paul-swift-b360b34" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </div>
      <div className="v5-wrap v5-footer-bottom">
        <span>
          © {new Date().getFullYear()} Beyondlean Ltd. Improvement never ends. · <a href={PHONE_HREF}>{PHONE}</a>
        </span>
      </div>
    </footer>
  );
}

/** Phone-only bar: the two actions stay one thumb away on every page. */
function MobileBar() {
  return (
    <nav className="v5-mobile-bar" aria-label="Quick actions">
      <a href={PHONE_HREF}>
        <Phone aria-hidden /> Call Paul
      </a>
      <a href={BOOK_HREF} className="is-primary">
        Book a free call <ArrowRight aria-hidden />
      </a>
    </nav>
  );
}

export function V5Shell({
  children,
  active,
  switcher,
}: {
  children: React.ReactNode;
  active: NavKey;
  switcher?: React.ReactNode;
}) {
  return (
    <div className={`bp-root bp-bca v5-root ${figtree.variable} ${instrumentSerif.variable}`} id="top" data-motion-root>
      <Nav active={active} />
      <main>{children}</main>
      <Footer />
      <MobileBar />
      <PremiumMotion />
      {switcher}
    </div>
  );
}

/** The navy band that opens every inner page. */
export function PageHero({
  crumb,
  light,
  strong,
  lede,
  children,
}: {
  crumb: { href: string; label: string }[];
  light?: string;
  strong: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="v5-page-hero" data-motion-hero>
      <div className="v5-hero-beams" aria-hidden />
      <div className="v5-wrap">
        <nav className="v5-crumbs" aria-label="Breadcrumb">
          <Link href={HOME}>Home</Link>
          {crumb.map((c) => (
            <span key={c.href}>
              <span aria-hidden>/</span>
              <Link href={c.href}>{c.label}</Link>
            </span>
          ))}
        </nav>
        <Heading as="h1" light={light} strong={strong} />
        {lede && <p className="v5-page-lede">{lede}</p>}
        {children}
      </div>
    </section>
  );
}

/** A compact BOSS Score opt-in that sits inside articles and case studies. */
export function ScoreCallout({ title = "Where is your business losing time and money?" }: { title?: string }) {
  return (
    <aside className="v5-callout">
      <div>
        <h3>{title}</h3>
        <p>Take the free BOSS Score: 13 quick questions, a score out of 100 across the 10 areas of your business.</p>
      </div>
      <CircleButton href={SCORE_HREF} tone="white">
        Get your free score
      </CircleButton>
    </aside>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="v5-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = "", children: c }) =>
            href.startsWith("/") ? (
              <Link href={href}>{c}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {c}
              </a>
            ),
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function CloseCard() {
  return (
    <section className="v5-close-wrap" aria-labelledby="v5-close-title">
      <div className="v5-wrap">
        <div className="v5-close">
          <div className="v5-close-copy">
            <h2 id="v5-close-title" className="v5-h2 is-dark">
              <span>Ready when you are.</span> <strong>Book a free value call.</strong>
            </h2>
            <p>
              Pick a time that suits you. We look at where your business is now, where you want it to be, and what&apos;s
              in the way. If I can&apos;t help, I&apos;ll tell you.
            </p>
            <CircleButton href={BOOK_HREF} tone="white">
              Book a free value call
            </CircleButton>
            <ul className="v5-close-contact">
              <li>
                <Phone aria-hidden />
                <a href={PHONE_HREF}>{PHONE}</a>
              </li>
            </ul>
          </div>
          <div className="v5-close-photo" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/beyondlean/paul-cutout.png" alt="" loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}
