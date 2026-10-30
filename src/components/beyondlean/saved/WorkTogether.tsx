import { SCORE_HREF } from "../data";
import { CircleButton, Heading } from "../v5/parts";
import "./workTogether.css";

/**
 * Saved from the old BCA home look (30 Oct 2026): Zander liked the three steps and may reuse them.
 * Not shown on any page yet. Drop it inside V5Shell to use it.
 */
const STEPS = [
  {
    title: "Get your BOSS Score",
    text: "13 quick questions. A score out of 100 across the 10 areas of your business, free.",
  },
  {
    title: "Talk it through",
    text: "On a value call we find the one or two things costing you most. You leave with a clear next step either way.",
  },
  {
    title: "Fix it, and make it stick",
    text: "A 90-day plan, worked through side by side and measured before and after.",
  },
];

export function WorkTogether() {
  return (
    <section className="v5-section bl-steps-section" aria-labelledby="bl-steps-title">
      <div className="v5-wrap">
        <div className="bl-steps-head" data-reveal>
          <Heading id="bl-steps-title" light="How we work together." strong="Score it. Talk it through. Fix it." center />
        </div>
        <ol className="bl-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`bl-step bl-step-${i + 1}`} data-reveal>
              <span className="bl-step-bar">Step {i + 1}</span>
              <div className="bl-step-body">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="bl-steps-cta">
          <CircleButton href={SCORE_HREF}>Get Your Free BOSS Score</CircleButton>
        </div>
      </div>
    </section>
  );
}
