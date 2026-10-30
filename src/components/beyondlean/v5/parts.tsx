import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, ArrowUp, Linkedin, Mail, MoveRight, Phone } from "lucide-react";
import { figtree, instrumentSerif } from "@/fonts";
import { BOOK_HREF, EMAIL, PHONE, SCORE_HREF } from "../data";
import { PremiumMotion } from "../PremiumMotion";
import { FaqList } from "./FaqList";
import { NavContact } from "./NavContact";
import { NavMenu } from "./NavMenu";
import "../beyondleanPremium.css";
import "../beyondleanBca.css";
import "../beyondleanV5.css";
import "./pages.css";

export const PHONE_HREF = "tel:+447843577771";
export const HOME = "/beyondlean";

export const NAV = [
  { href: `${HOME}/about`, label: "About", key: "about" },
  { href: `${HOME}/how-it-works`, label: "How It Works", key: "how" },
  { href: `${HOME}/case-studies`, label: "Case Studies", key: "cases" },
  { href: `${HOME}/blog`, label: "Blog", key: "blog" },
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
      {children}
      <MoveRight aria-hidden />
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
        <div className="v5-nav-actions">
          <NavContact>
            <a href={PHONE_HREF}>
              <span className="v5-contact-icon">
                <Phone aria-hidden />
              </span>
              <span>
                <strong>{PHONE}</strong>
                <small>Call Paul</small>
              </span>
            </a>
            <a href={WHATSAPP_HREF} target="_blank" rel="noreferrer">
              <span className="v5-contact-icon is-whatsapp">
                <WhatsAppIcon />
              </span>
              <span>
                <strong>WhatsApp</strong>
                <small>Message Paul</small>
              </span>
            </a>
            <a href={`mailto:${EMAIL}`}>
              <span className="v5-contact-icon">
                <Mail aria-hidden />
              </span>
              <span>
                <strong>{EMAIL}</strong>
                <small>Email Paul</small>
              </span>
            </a>
          </NavContact>
          <a className="v5-phone" href={BOOK_HREF}>
            <span>Book a Call</span>
            <ArrowRight aria-hidden />
          </a>
          <NavMenu links={NAV} active={active} />
        </div>
      </div>
    </header>
  );
}

/** Preview only: flips a redesigned page back to its earlier version until Zander picks one. */
export function VersionSwitch({ current }: { current: "new" | "old" }) {
  return (
    <nav className="bl-switch" aria-label="Page versions (preview only)">
      <span>Version</span>
      <a href="?" aria-current={current === "new" ? "page" : undefined}>
        New
      </a>
      <a href="?v=old" aria-current={current === "old" ? "page" : undefined}>
        Old
      </a>
    </nav>
  );
}

const WHATSAPP_HREF = "https://wa.me/447843577771";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.99.59 3.84 1.61 5.4L2 22l4.94-1.63a9.86 9.86 0 0 0 5.1 1.4h.01c5.46 0 9.89-4.4 9.89-9.84C21.94 6.4 17.5 2 12.04 2Zm0 17.93h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.05.8.82-2.97-.19-.31a8.07 8.07 0 0 1-1.24-4.31c0-4.47 3.66-8.1 8.12-8.1 2.17 0 4.21.84 5.75 2.37a8.02 8.02 0 0 1 2.37 5.73c0 4.47-3.66 8.1-8.14 8.1Zm4.46-6.06c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.78.95-.14.16-.29.18-.53.06-.24-.12-1.02-.37-1.94-1.2-.72-.64-1.2-1.42-1.34-1.66-.14-.24-.02-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.24-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.73 2.64 4.2 3.7.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
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
          <a href={BOOK_HREF}>Book a Constraint Call</a>
        </div>
        <div className="v5-footer-contact">
          <h3>Contact</h3>
          <a href={PHONE_HREF}>
            <Phone aria-hidden /> +44 7843 577771
          </a>
          <a href={`mailto:${EMAIL}`}>
            <Mail aria-hidden /> {EMAIL}
          </a>
          <a href="https://www.linkedin.com/in/paul-swift-b360b34" target="_blank" rel="noreferrer">
            <Linkedin aria-hidden /> LinkedIn
          </a>
          <a className="v5-footer-whatsapp" href={WHATSAPP_HREF} target="_blank" rel="noreferrer">
            <WhatsAppIcon /> WhatsApp
          </a>
        </div>
      </div>
      <div className="v5-wrap v5-footer-bottom">
        <span>
          © {new Date().getFullYear()} Beyondlean Ltd. Improvement never ends. · <a href={PHONE_HREF}>{PHONE}</a>
        </span>
        <a href="#top" className="v5-footer-top">
          Back to top <ArrowUp aria-hidden />
        </a>
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
        Book a Call <ArrowRight aria-hidden />
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
  light,
  strong,
  lede,
  photo,
  children,
}: {
  light?: string;
  strong: string;
  lede?: string;
  /** A photo on the right that fades into the navy behind the words. */
  photo?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="v5-page-hero" data-motion-hero>
      {photo ? (
        <div className="v5-page-hero-photo" aria-hidden>
          <Image src={photo} alt="" fill sizes="(max-width: 900px) 100vw, 64vw" priority />
        </div>
      ) : (
        <div className="v5-hero-beams" aria-hidden />
      )}
      <div className="v5-wrap">
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
        Get Your Free Score
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

/** Questions in the open, centred, with topic tabs and a way to ask anything else.
 *  `side`: heading and the ask card on the left, questions on the right (home, on trial beside the centred one). */
export function FaqSection({ side = false }: { side?: boolean }) {
  if (side) {
    return (
      <section className="v5-section v5-white" id="faq" aria-labelledby="v5-faq-title">
        <div className="v5-wrap v5-faq-side">
          <div className="v5-faq-side-left" data-reveal>
            <p className="v5-eyebrow">FAQs</p>
            <Heading id="v5-faq-title" light="Questions owners" strong="ask first." />
            <div className="v5-faq-side-ask">
              <p>
                Can&apos;t find your answer? Call me on <a href={PHONE_HREF}>{PHONE}</a>, or ask me on a Constraint
                Call.
              </p>
              <a className="v5-pill-btn" href={BOOK_HREF}>
                Book a Constraint Call <MoveRight aria-hidden />
              </a>
            </div>
          </div>
          <FaqList chevron />
        </div>
      </section>
    );
  }
  return (
    <section className="v5-section v5-white" id="faq" aria-labelledby="v5-faq-title">
      <div className="v5-wrap">
        <div className="v5-head is-center" data-reveal>
          <Heading id="v5-faq-title" light="Questions owners" strong="ask first." center />
        </div>
        <FaqList />
        <div className="v5-faq2-ask" data-reveal>
          <div>
            <h3>Can&apos;t find your answer?</h3>
            <p>
              Call me on <a href={PHONE_HREF}>{PHONE}</a>, or book a Constraint Call and ask me there.
            </p>
          </div>
          <CircleButton href={BOOK_HREF}>Book a Constraint Call</CircleButton>
        </div>
      </div>
    </section>
  );
}

/** Dark card with the words on the left and a photo filling the right half. Used for the score and the call. */
export function CtaCard({
  id,
  eyebrow,
  light,
  strong,
  text,
  href,
  label,
  photo,
  children,
}: {
  id: string;
  eyebrow: string;
  light: string;
  strong: string;
  text: string;
  href: string;
  label: string;
  photo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="v5-cta" data-reveal>
      <div className="v5-cta-copy">
        <p className="v5-cta-eyebrow">{eyebrow}</p>
        <h2 id={id} className="v5-cta-title">
          <span>{light}</span> <strong>{strong}</strong>
        </h2>
        <p className="v5-cta-text">{text}</p>
        <a className="v5-cta-btn" href={href}>
          {label} <MoveRight aria-hidden />
        </a>
        {children}
      </div>
      <div className="v5-cta-media">
        <Image src={photo} alt="" fill sizes="(max-width: 900px) 100vw, 620px" />
      </div>
    </div>
  );
}

export function CloseCard({ old = false }: { old?: boolean }) {
  if (!old) {
    return (
      <section className="v5-close-wrap" aria-labelledby="v5-close-title">
        <div className="v5-wrap">
          <CtaCard
            id="v5-close-title"
            eyebrow="Free, 30 minutes, one to one"
            light="One thing is holding"
            strong="your business back."
            text="We find it together, plus the one to three things to fix first. If I can't help, I'll tell you."
            href={BOOK_HREF}
            label="Book a Constraint Call"
            photo="/beyondlean/paul-whiteboard.jpg"
          />
        </div>
      </section>
    );
  }
  return (
    <section className="v5-close-wrap" aria-labelledby="v5-close-title">
      <div className="v5-wrap">
        <div className="v5-close">
          <div className="v5-close-copy">
            <h2 id="v5-close-title" className="v5-h2 is-dark">
              <span>Ready when you are.</span> <strong>Book a Constraint Call.</strong>
            </h2>
            <p>
              Pick a time that suits you. We look at where your business is now, where you want it to be, and what&apos;s
              in the way. If I can&apos;t help, I&apos;ll tell you.
            </p>
            <CircleButton href={BOOK_HREF} tone="white">
              Book a Constraint Call
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
