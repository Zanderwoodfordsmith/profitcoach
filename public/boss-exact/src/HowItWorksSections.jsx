/* global React, Icon, BossWheel */
const { useState: useStateH2 } = React;

// Hero for How It Works
function HowItWorksHero() {
  return (
    <section style={{
      position: "relative", overflow: "hidden",
      background: `radial-gradient(ellipse 70% 60% at 18% 12%, rgba(66,161,238,0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 92% 28%, rgba(13,148,136,0.13), transparent 55%), #f5f8fc`,
      paddingTop: 80, paddingBottom: 96,
    }}>
      <div className="pc-container" style={{ position: "relative", textAlign: "center" }}>
        <div className="reveal" style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", gap: 10, alignItems: "center",
            padding: "6px 16px 6px 6px", borderRadius: 9999,
            background: "rgba(255,255,255,0.7)", border: "1px solid rgba(12,82,144,0.10)",
            backdropFilter: "blur(8px)", fontSize: 12, fontWeight: 600, color: "#0c5290", letterSpacing: "0.05em",
          }}>
            <span style={{ background: "#0c5290", color: "#fff", padding: "3px 10px", borderRadius: 9999, fontSize: 10, letterSpacing: "0.2em" }}>HOW IT WORKS</span>
            One coach. One system. One business that pays you back.
          </div>
          <h1 style={{
            margin: "26px auto 22px",
            fontSize: "clamp(40px, 5.4vw, 76px)", lineHeight: 1.02, fontWeight: 300,
            letterSpacing: "-0.035em", color: "#0f172a", maxWidth: "16ch",
          }}>
            How a Profit Coach<br />
            <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#0c5290,#1ca0c2,#42a1ee)", WebkitBackgroundClip: "text", color: "transparent" }}>actually changes</em> a business.
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: "#475569", maxWidth: 660, margin: "0 auto 36px" }}>
            Not advice. Not theory. A diagnostic-led, sequenced install of the operating system every owner-led business needs — delivered one-to-one, paced to the level you're actually at.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#" className="pc-btn pc-btn--primary">Take the BOSS Diagnostic <Icon name="arrowRight" size={16} strokeWidth={2.25} /></a>
            <a href="#five-levels" className="pc-btn pc-btn--secondary">See the 5 Levels</a>
          </div>
        </div>
      </div>
    </section>
  );
}

// Section: Diagnostic walkthrough — three steps
function DiagnosticWalkthrough() {
  const steps = [
    { n: "01", title: "Diagnose", body: "50 questions across 10 areas of business. Scored 0/1/2. The result is your BOSS Score, your Level, and a heat-map showing exactly where the business leaks.", time: "10 minutes" },
    { n: "02", title: "Sequence", body: "Your coach takes the diagnostic and builds a 90-day plan — three priorities, ordered by impact and ease. Not 30 things. Not a 'wish list'. Three.", time: "Week 1" },
    { n: "03", title: "Install", body: "Each priority maps to a Profit System playbook. Your coach walks it in with you, week by week, on your numbers, with your team.", time: "Weeks 2–12" },
    { n: "04", title: "Re-score", body: "Re-take the diagnostic at 90 days. See the deltas — by area, by level, on the wheel and the grid. Then the next 90 days.", time: "Day 90" },
  ];
  return (
    <section className="pc-section" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 720, marginBottom: 56 }}>
          <span className="pc-eyebrow">The Engagement Cadence</span>
          <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
            Diagnose. Sequence. Install. Re-score.
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: "#475569", margin: 0 }}>
            Every 90 days, the loop repeats. The work compounds. The score moves. You can see it.
          </p>
        </div>
        <div className="pc-walk-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
          {steps.map((s, i) => (
            <div key={s.n} className="pc-card reveal" style={{ transitionDelay: `${i * 50}ms`, padding: 28, position: "relative" }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "#0c5290", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 18, height: 1, background: "#0c5290" }}></span>{s.n}
              </div>
              <h3 style={{ margin: "16px 0 14px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "#0f172a" }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#475569" }}>{s.body}</p>
              <div style={{
                marginTop: 18, padding: "5px 10px", display: "inline-flex",
                fontSize: 11, fontWeight: 600, color: "#047857", letterSpacing: "0.06em",
                background: "rgba(16,185,129,0.10)", borderRadius: 9999,
              }}>{s.time}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .pc-walk-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .pc-walk-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

// Section: 10 Areas grid — the structural motif
function TenAreasGrid() {
  const areas = [
    { n: "01", name: "Owner Performance", note: "The foundation. Most frameworks skip this. We don't." },
    { n: "02", name: "Vision & Alignment", note: "What is the business for, and does the team know?" },
    { n: "03", name: "Strategy", note: "Where to play, where not to, what wins." },
    { n: "04", name: "Planning & Execution", note: "Quarterly priorities. Weekly cadence." },
    { n: "05", name: "Profit & Cash Flow", note: "Margin, runway, working capital." },
    { n: "06", name: "Revenue & Marketing", note: "Predictable lead flow." },
    { n: "07", name: "Operations & Delivery", note: "Quality without the owner." },
    { n: "08", name: "Financials & Metrics", note: "The dashboard owners read in 30 seconds." },
    { n: "09", name: "Infrastructure & Systems", note: "How the work gets done — documented." },
    { n: "10", name: "Team & Leadership", note: "Leaders who own outcomes, not tasks." },
  ];
  return (
    <section className="pc-section" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="reveal" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start", marginBottom: 48 }} data-cls="pc-areas-head">
          <div>
            <span className="pc-eyebrow">10 Areas × 5 Levels</span>
            <h2 style={{ margin: "16px 0 0", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.06, color: "#0f172a" }}>
              The whole business, on one grid.
            </h2>
          </div>
          <div>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "#475569", margin: 0 }}>
              <strong style={{ color: "#0f172a", fontWeight: 600 }}>10 areas of the business.</strong> <strong style={{ color: "#0f172a", fontWeight: 600 }}>5 levels of performance.</strong> Score every cell. The result is a map of every gap, every quick win, and every leverage point — across the entire business — on a single page.
            </p>
          </div>
        </div>

        <div className="reveal pc-areas-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12,
          background: "#fff", padding: 12, borderRadius: 24,
          border: "1px solid var(--pc-slate-200)",
          boxShadow: "0 16px 60px -24px rgba(15,23,42,0.10)",
        }}>
          {areas.map((a, i) => (
            <div key={a.n} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              gap: 16, alignItems: "center",
              padding: "18px 20px", borderRadius: 16,
              background: i === 0 ? "linear-gradient(145deg,#42a1ee15,#0c529008)" : "transparent",
              border: i === 0 ? "1px solid rgba(12,82,144,0.20)" : "1px solid transparent",
            }}>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.06em" }}>{a.n}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em" }}>{a.name}{i === 0 && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "rgba(12,82,144,0.10)", color: "#0c5290", letterSpacing: "0.10em", textTransform: "uppercase", verticalAlign: "middle" }}>Foundation</span>}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{a.note}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2, 3, 4].map(lv => {
                  const filled = lv < ((i * 13 + 7) % 5); // pseudo-random fill for visual rhythm
                  const colors = ["#e11d48", "#f59e0b", "#1ca0c2", "#0c5290", "#10b981"];
                  return <span key={lv} style={{ width: 18, height: 8, borderRadius: 4, background: filled ? colors[lv] : "#f1f5f9", border: filled ? "none" : "1px solid #e2e8f0" }} />;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 880px) {
          [data-cls="pc-areas-head"] { grid-template-columns: 1fr !important; gap: 24px !important; }
          .pc-areas-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

// Section: 3 Pillars
function ThreePillars() {
  const pillars = [
    { tag: "Pillar 01", name: "Control", color: "#0c5290", grad: "linear-gradient(135deg,#0c5290,#063056)", body: "Visibility, structure, accountability. What does the business actually do, who owns what, and how do you know it's happening?", solves: ["Firefighting", "Owner-as-bottleneck", "No real numbers", "Ad-hoc decisions"] },
    { tag: "Pillar 02", name: "Velocity", color: "#42a1ee", grad: "linear-gradient(135deg,#42a1ee,#1d6fb5)", body: "Cash, momentum, quick wins. The interventions that put money in the bank inside 90 days, while the longer plays compound in the background.", solves: ["Cash-flow stress", "Stalled growth", "Marketing that doesn't deliver", "Margin leaks"] },
    { tag: "Pillar 03", name: "Value", color: "#1ca0c2", grad: "linear-gradient(135deg,#1ca0c2,#0e7490)", body: "Sustainable growth. People, leadership, strategy, succession. The work that turns a business into an asset that scales beyond the owner.", solves: ["Owner-dependence", "Leadership gaps", "Lack of strategy", "No succession plan"] },
  ];
  return (
    <section className="pc-section" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 720, marginBottom: 48 }}>
          <span className="pc-eyebrow">The 3 Pillars</span>
          <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.06, color: "#0f172a" }}>
            Control. Velocity. Value.
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "#475569", margin: 0 }}>
            The 10 areas group into three pillars. Together they cover what every owner-led business actually needs — in the order that produces results.
          </p>
        </div>
        <div className="pc-pillars-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {pillars.map((p, i) => (
            <div key={p.name} className="pc-card reveal" style={{ transitionDelay: `${i * 60}ms`, padding: 32, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: p.grad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", boxShadow: `0 12px 24px -8px ${p.color}66` }}>{(i + 1).toString().padStart(2, "0")}</div>
                <div>
                  <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: p.color, letterSpacing: "0.16em", textTransform: "uppercase" }}>{p.tag}</div>
                  <h3 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>{p.name}</h3>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#475569" }}>{p.body}</p>
              <div style={{ paddingTop: 18, borderTop: "1px dashed var(--pc-slate-300)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>What it solves</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.solves.map(s => <span key={s} style={{ fontSize: 12, fontWeight: 500, color: "#334155", padding: "5px 10px", borderRadius: 9999, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>{s}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .pc-pillars-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

window.HowItWorksHero = HowItWorksHero;
window.DiagnosticWalkthrough = DiagnosticWalkthrough;
window.TenAreasGrid = TenAreasGrid;
window.ThreePillars = ThreePillars;
