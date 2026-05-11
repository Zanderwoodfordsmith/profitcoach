/* global React, Icon */
const { useState: useStateR, useMemo: useMemoR } = React;

// Funnel Multiplier — interactive ROI calculator
function ROICalculator() {
  const [leads, setLeads] = useStateR(40);
  const [conv, setConv] = useStateR(35);
  const [close, setClose] = useStateR(40);
  const [deal, setDeal] = useStateR(8000);
  const [tx, setTx] = useStateR(1.4);
  const [lift, setLift] = useStateR(10);

  const baseRev = useMemoR(() => leads * (conv / 100) * (close / 100) * deal * tx * 12, [leads, conv, close, deal, tx]);
  const factor = Math.pow(1 + lift / 100, 5);
  const newRev = baseRev * factor;
  const upliftAbs = newRev - baseRev;
  const upliftPct = (factor - 1) * 100;

  const fmt = (n) => "£" + Math.round(n).toLocaleString("en-GB");
  const fmtCompact = (n) => {
    if (n >= 1e6) return "£" + (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return "£" + Math.round(n / 1e3) + "K";
    return "£" + Math.round(n);
  };

  const Slider = ({ label, value, set, min, max, step, format }) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{label}</label>
        <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "#0c5290", letterSpacing: "-0.01em" }}>{format ? format(value) : value}</div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#0c5290", height: 6 }} />
    </div>
  );

  return (
    <section className="pc-section" style={{ background: "linear-gradient(135deg,#0c5290 0%,#073157 60%,#061a2e 100%)", color: "#fff", position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none", background: "radial-gradient(circle at 80% 20%, rgba(66,161,238,0.4), transparent 50%), radial-gradient(circle at 15% 80%, rgba(28,160,194,0.3), transparent 55%)" }} />
      <div className="pc-container" style={{ position: "relative" }}>
        <div className="pc-roi-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 64, alignItems: "center" }}>
          <div className="reveal">
            <span className="pc-eyebrow eyebrow-on-dark" style={{ color: "#9fbde7" }}>The Funnel Multiplier</span>
            <h2 style={{ margin: "16px 0 22px", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.06, color: "#fff" }}>
              The maths behind <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#fff,#9fbde7)", WebkitBackgroundClip: "text", color: "transparent" }}>30–130%.</em>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "#cfdef3", margin: "0 0 16px" }}>
              Five levers run your revenue: leads, conversion to appointments, close rate, deal value, transactions per customer per year.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "#cfdef3", margin: "0 0 24px" }}>
              Improve each one by just 10% and revenue compounds: 1.1 × 1.1 × 1.1 × 1.1 × 1.1 = <strong style={{ color: "#fff" }}>1.61</strong> — a 61% lift. Push to 15% across the board and you've doubled.
            </p>
            <div style={{ padding: "16px 20px", borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 14, color: "#9fbde7", lineHeight: 1.6 }}>
              Slide the sliders. The numbers are yours, not ours.
            </div>
          </div>

          <div className="reveal" style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(20px)", borderRadius: 28, padding: 28,
            boxShadow: "0 30px 80px -24px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <div className="pc-eyebrow eyebrow-on-dark" style={{ color: "#9fbde7", fontSize: 11 }}>Your Numbers</div>
                <div style={{ fontSize: 14, color: "#cfdef3", marginTop: 4 }}>Five levers · One result</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 9999, background: "rgba(16,185,129,0.18)", color: "#34d399", letterSpacing: "0.06em" }}>LIVE</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 22 }}>
              <Slider label="Leads / month" value={leads} set={setLeads} min={5} max={300} step={1} />
              <Slider label="Lead → appointment %" value={conv} set={setConv} min={5} max={80} step={1} format={v => v + "%"} />
              <Slider label="Close rate %" value={close} set={setClose} min={5} max={80} step={1} format={v => v + "%"} />
              <Slider label="Average deal value" value={deal} set={setDeal} min={500} max={50000} step={100} format={v => "£" + v.toLocaleString("en-GB")} />
              <Slider label="Transactions / customer / yr" value={tx} set={setTx} min={1} max={6} step={0.1} format={v => v.toFixed(1) + "x"} />
              <Slider label="% lift on each lever" value={lift} set={setLift} min={5} max={25} step={1} format={v => "+" + v + "%"} />
            </div>

            <div style={{
              padding: "20px 22px", borderRadius: 18,
              background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(12,82,144,0.18))",
              border: "1px solid rgba(255,255,255,0.14)",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9fbde7", letterSpacing: "0.18em", textTransform: "uppercase" }}>Today</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "#cfdef3", marginTop: 4, letterSpacing: "-0.02em" }}>{fmtCompact(baseRev)}</div>
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9fbde7", letterSpacing: "0.18em", textTransform: "uppercase" }}>After +{lift}% × 5</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 4, letterSpacing: "-0.02em" }}>{fmtCompact(newRev)}</div>
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#34d399", letterSpacing: "0.18em", textTransform: "uppercase" }}>Uplift</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "#34d399", marginTop: 4, letterSpacing: "-0.02em" }}>+{fmtCompact(upliftAbs)}</div>
                <div className="mono" style={{ fontSize: 12, color: "#34d399", marginTop: 2, fontWeight: 600 }}>+{Math.round(upliftPct)}%</div>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: "#9fbde7", lineHeight: 1.5, fontStyle: "italic" }}>
              Illustrative. Your real funnel will have its own numbers — that's exactly what the diagnostic finds.
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .pc-roi-grid { grid-template-columns: 1fr !important; gap: 48px !important; } }
        input[type=range] { -webkit-appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-runnable-track { height: 6px; background: rgba(255,255,255,0.15); border-radius: 9999px; }
        input[type=range]::-moz-range-track { height: 6px; background: rgba(255,255,255,0.15); border-radius: 9999px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; margin-top: -6px; border-radius: 9999px; background: #fff; border: 2px solid #42a1ee; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        input[type=range]::-moz-range-thumb { height: 18px; width: 18px; border-radius: 9999px; background: #fff; border: 2px solid #42a1ee; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
      `}</style>
    </section>
  );
}

// The "every level has its devil" honesty section
function PaceAndCommitment() {
  return (
    <section className="pc-section" style={{ background: "#fff" }}>
      <div className="pc-container" style={{ maxWidth: 880 }}>
        <div className="reveal" style={{ textAlign: "center" }}>
          <span className="pc-eyebrow">An Honest Note on Pace</span>
          <h2 style={{ margin: "16px 0 24px", fontSize: "clamp(28px, 3.4vw, 44px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.1, color: "#0f172a" }}>
            Building a business that pays you back takes time.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "#475569", margin: "0 0 18px" }}>
            The first 90 days produce real, visible movement — that's the design. But turning a job into an asset is the work of years, not weeks.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "#475569", margin: "0 0 18px" }}>
            Every level has its devil. The work that gets you to Organised will not get you to Overseer. The work that gets you to Overseer is not what makes you an Owner. A coach worth keeping is the one who walks you through each — at the pace your business can actually absorb.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "#0f172a", margin: 0, fontWeight: 600 }}>
            That's why most Profit Coach engagements last for years. Not because the work doesn't get done — because once it does, there's another level waiting.
          </p>
        </div>
      </div>
    </section>
  );
}

// Simple closing CTA, reused on both new pages
function PageCTA({ title, sub }) {
  return (
    <section style={{
      padding: "120px 0",
      background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(66,161,238,0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(28,160,194,0.14), transparent 55%), #fff`,
      borderTop: "1px solid #eaf0f7", textAlign: "center",
    }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 22px", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
            {title || (<>Find out where you stand. <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#0c5290,#1ca0c2)", WebkitBackgroundClip: "text", color: "transparent" }}>In 10 minutes.</em></>)}
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#475569", margin: "0 0 32px" }}>
            {sub || "The BOSS Diagnostic gives you your full score across all 10 areas, your level, and the three highest-leverage moves for the next 90 days. Free. No call required."}
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#" className="pc-btn pc-btn--primary">Take the BOSS Diagnostic <Icon name="arrowRight" size={16} strokeWidth={2.25} /></a>
            <a href="#" className="pc-btn pc-btn--secondary">Speak to a Coach</a>
          </div>
        </div>
      </div>
    </section>
  );
}

window.ROICalculator = ROICalculator;
window.PaceAndCommitment = PaceAndCommitment;
window.PageCTA = PageCTA;
