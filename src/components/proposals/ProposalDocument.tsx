import type { ReactNode } from "react";
import { CircleCheck, PenLine } from "lucide-react";
import { ExplainerDigitalNav } from "@/components/coachExplainer/ExplainerDigitalNav";
import type { ExplainerCoach } from "@/lib/coachExplainer/fromBlueprint";
import { parseProposalBody, type Proposal, type ProposalSection } from "@/lib/proposals/types";
import { PrintButton } from "./PrintButton";
import { ProposalBody } from "./ProposalBody";
import "@/components/coachExplainer/explainerDigital.css";
import "./proposal.css";

/**
 * What the prospect reads: the coach's proposal in the explainer's layout
 * (navy cover, side menu, sections), ending in the place to sign. Printing
 * the page is the PDF.
 */
export function ProposalDocument({
  proposal,
  coach,
  coachName,
  sign,
}: {
  proposal: Pick<Proposal, "kind" | "prospect_name" | "prospect_business" | "sections" | "sent_at" | "created_at" | "signed_at">;
  coach: ExplainerCoach | null;
  coachName: string;
  /** The signing block, or what was signed. A welcome pack has none. */
  sign: ReactNode | null;
}) {
  const welcome = proposal.kind === "welcome";
  const sections = proposal.sections.filter((s) => !s.hidden && s.body.trim());
  const nav = [...sections.map((s) => ({ id: s.key, title: s.title })), ...(sign ? [{ id: "sign", title: "Accept and sign" }] : [])];
  const clientFirst = proposal.prospect_name.trim().split(/\s+/)[0];
  const date = new Date(proposal.sent_at ?? proposal.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const photo = coach?.site.photo;

  return (
    <div className="cxd cxp">
      <header className="cxd-hero">
        <div className="cxd-hero__inner">
          <div className="cxd-hero__top">
            {/* eslint-disable-next-line @next/next/no-img-element -- small SVG logo. */}
            <img className="cxd-logo" src="/brand/profit-coach-logo-white.svg" alt="The Profit Coach" />
            <p>
              {welcome ? "Welcome pack" : "Proposal"} · {date}
            </p>
          </div>
          <div className="cxd-hero__grid">
            <div>
              {welcome ? (
                <>
                  <h1 className="cxd-hero__title">
                    <span>Welcome to coaching,</span>
                    <strong>{clientFirst}.</strong>
                  </h1>
                  <p className="cxd-hero__standfirst">
                    {proposal.prospect_business ? `${proposal.prospect_business} and ${coachName}.` : `With ${coachName}.`} Your first
                    month, how we work together, and what I need from you.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="cxd-hero__title">
                    <span>A proposal for</span>
                    <strong>{proposal.prospect_business || proposal.prospect_name}</strong>
                  </h1>
                  <p className="cxd-hero__standfirst">
                    Prepared for {proposal.prospect_name} by {coachName}.
                  </p>
                </>
              )}
            </div>
            <div className="cxd-hero__coach">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- coach photos come from storage.
                <img className="cxd-hero__portrait" src={photo.src} alt={photo.alt} />
              ) : (
                <span className="cxd-hero__portrait cxd-portrait--empty" aria-hidden="true">
                  {coachName.slice(0, 1)}
                </span>
              )}
              <div>
                <p className="cxd-hero__name">{coachName}</p>
                <p className="cxd-hero__role">
                  Profit Coach{coach?.site.place ? ` · ${coach.site.place.label}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="cxd-layout">
        <ExplainerDigitalNav
          items={nav}
          coachName={coachName}
          actions={
            <>
              {!sign ? null : proposal.signed_at ? (
                <a className="cxd-btn cxd-btn--quiet" href="#sign">
                  <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />
                  Signed
                </a>
              ) : (
                <a className="cxd-btn cxd-btn--solid" href="#sign">
                  <PenLine size={16} strokeWidth={2} aria-hidden="true" />
                  Accept and sign
                </a>
              )}
              <PrintButton className="cxd-btn cxd-btn--quiet" />
            </>
          }
        />
        <main className="cxd-main">
          {sections.map((section) =>
            section.key === "investment" ? <Investment key={section.key} section={section} /> : <Part key={section.key} section={section} />
          )}
          {sign ? (
            <section id="sign" className="cxd-section cxp-sign" aria-labelledby="sign-h">
              <h2 id="sign-h" className="cxd-h2">
                <strong>Accept and sign</strong>
              </h2>
              {sign}
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function Part({ section }: { section: ProposalSection }) {
  return (
    <section id={section.key} className={`cxd-section cxp-part cxp-part--${section.key}`} aria-labelledby={`${section.key}-h`}>
      <h2 id={`${section.key}-h`} className="cxd-h2">
        <strong>{section.title}</strong>
      </h2>
      <ProposalBody body={section.body} />
    </section>
  );
}

/** The price leads, large, on the navy panel; the rest reads underneath. */
function Investment({ section }: { section: ProposalSection }) {
  const [first, ...rest] = section.body.split(/\n\s*\n/);
  const lead = parseProposalBody(first ?? "")[0];
  const price = lead?.kind === "p" ? lead.text : null;
  return (
    <section id={section.key} className="cxd-section cxd-invest cxp-invest" aria-labelledby={`${section.key}-h`}>
      <h2 id={`${section.key}-h`} className="cxd-invest__label">
        {section.title}
      </h2>
      {price ? <p className="cxp-invest__price">{price}</p> : null}
      <ProposalBody body={price ? rest.join("\n\n") : section.body} />
    </section>
  );
}
