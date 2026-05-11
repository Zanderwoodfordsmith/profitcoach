/* global React, Icon, BossWheel, BOSS_AREAS */
const { useState: useStateRP, useEffect: useEffectRP } = React;

// ============================================================
// Report header — owner identity + score + level + date
// ============================================================
function ReportHeader() {
  return (
    <section style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg,#0c5290 0%,#073157 60%,#061a2e 100%)",
      color: "#fff", paddingTop: 56, paddingBottom: 48,
    }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.55, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 88% 18%, rgba(66,161,238,0.5), transparent 55%), radial-gradient(ellipse 50% 50% at 8% 80%, rgba(28,160,194,0.35), transparent 55%)" }} />
      <div className="pc-container" style={{ position: "relative" }}>
        {/* breadcrumb / meta */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 9999, background: "rgba(16,185,129,0.20)", color: "#34d399", letterSpacing: "0.18em" }}>BOSS REPORT</span>
            <span className="mono" style={{ fontSize: 12, color: "#9fbde7" }}>Generated · 12 May 2026 · 14:32</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="rp-chip">↓ Download PDF</button>
            <button className="rp-chip">Share</button>
            <button className="rp-chip rp-chip--solid">Book Review →</button>
          </div>
        </div>

        <div className="rp-head-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: "#9fbde7", fontWeight: 500, marginBottom: 6 }}>For</div>
            <h1 style={{ margin: "0 0 8px", fontSize: "clamp(34px, 4.6vw, 56px)", lineHeight: 1.04, fontWeight: 300, letterSpacing: "-0.035em", color: "#fff" }}>
              Sarah Mitchell · <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#42a1ee,#34d399)", WebkitBackgroundClip: "text", color: "transparent" }}>Mitchell &amp; Co.</em>
            </h1>
            <div style={{ fontSize: 15, color: "#cfdef3", marginBottom: 28 }}>
              Professional services · 14 employees · £1.8M revenue
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "#cfdef3", margin: 0, maxWidth: 540 }}>
              You're at <strong style={{ color: "#fff" }}>Level 02 — Overworked.</strong> Your business is real, growing, and working — and you're still its engine. The next level is closer than you think. Here's the picture, and the plan.
            </p>
          </div>

          {/* Big score card */}
          <div style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(20px)", borderRadius: 28, padding: 28,
            boxShadow: "0 24px 60px -20px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#9fbde7", letterSpacing: "0.20em" }}>BOSS SCORE</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 9999, background: "rgba(245,158,11,0.18)", color: "#fbbf24", letterSpacing: "0.16em", whiteSpace: "nowrap" }}>LEVEL 02 · OVERWORKED</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
              <div className="mono" style={{
                fontSize: 96, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em",
                background: "linear-gradient(135deg,#fff,#cfdef3)",
                WebkitBackgroundClip: "text", color: "transparent",
              }}>42</div>
              <div style={{ fontSize: 22, color: "#9fbde7", fontWeight: 400 }}>/100</div>
              <div style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 9999, background: "rgba(52,211,153,0.18)", color: "#34d399", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="trending" size={12} strokeWidth={2.5} /> +18 in 90d
              </div>
            </div>
            {/* Gauge with level markers */}
            <div style={{ position: "relative", height: 10, borderRadius: 9999, background: "rgba(255,255,255,0.10)", marginBottom: 8, overflow: "hidden" }}>
              <div style={{ width: "42%", height: "100%", background: "linear-gradient(90deg,#e11d48,#f59e0b 25%,#1ca0c2 50%,#0c5290 75%,#10b981)" }} />
              <div style={{ position: "absolute", left: "42%", top: -4, transform: "translateX(-50%)", width: 4, height: 18, background: "#fff", borderRadius: 9999, boxShadow: "0 0 0 3px rgba(255,255,255,0.20)" }} />
            </div>
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9fbde7", letterSpacing: "0.10em", paddingTop: 4 }}>
              <span>0</span><span>OVERWHELMED</span><span>OVERWORKED</span><span>ORGANISED</span><span>OVERSEER</span><span>OWNER</span><span>100</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .rp-chip { font-family: var(--font-sans); font-size: 13px; font-weight: 600; color: #fff; padding: 8px 14px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); cursor: pointer; transition: background 200ms ease, border-color 200ms ease; }
        .rp-chip:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.4); }
        .rp-chip--solid { background: linear-gradient(135deg,#10b981,#047857); border-color: transparent; box-shadow: 0 12px 24px -10px rgba(16,185,129,0.5); }
        .rp-chip--solid:hover { filter: brightness(1.08); }
        @media (max-width: 880px) { .rp-head-grid { grid-template-columns: 1fr !important; gap: 32px !important; } }
      `}</style>
    </section>
  );
}

// ============================================================
// Snapshot row — wheel + key stats
// ============================================================
function SnapshotRow() {
  const stats = [
    { label: "Strongest area", value: "Vision & Alignment", sub: "Score 7/10", color: "#10b981" },
    { label: "Biggest leak", value: "Operations & Delivery", sub: "Score 2/10", color: "#e11d48" },
    { label: "Quick win", value: "Document Sales Process", sub: "+8 BOSS pts est.", color: "#42a1ee" },
    { label: "1-yr revenue uplift", value: "+£186,000", sub: "Funnel multiplier @ 10%", color: "#0c5290" },
  ];
  return (
    <section className="pc-section" data-screen-label="Report / Snapshot" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="reveal" style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56, alignItems: "center" }} data-cls="rp-snap-grid">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <BossWheel size={460} />
          </div>
          <div>
            <span className="pc-eyebrow">Your Snapshot</span>
            <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(28px, 3.4vw, 40px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
              The whole picture, on one wheel.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#475569", margin: "0 0 28px" }}>
              The inner line is your current score on each area. The outer line is best-in-class. The gap is the work — and it's easier to close than it looks once it's sequenced.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {stats.map((s) => (
                <div key={s.label} style={{ padding: "16px 18px", borderRadius: 14, background: "#fff", border: "1px solid var(--pc-slate-200)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.color, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { [data-cls="rp-snap-grid"] { grid-template-columns: 1fr !important; gap: 40px !important; } }`}</style>
    </section>
  );
}

// ============================================================
// 10 Areas heatmap — bar list
// ============================================================
function AreasHeatmap() {
  const areas = [
    { n: "01", name: "Owner Performance", score: 4, target: 8, note: "Doing too much. Not enough leverage." },
    { n: "02", name: "Vision & Alignment", score: 7, target: 9, note: "Clear vision. Team alignment thinning." },
    { n: "03", name: "Strategy", score: 5, target: 8, note: "Direction is right. Execution gap widening." },
    { n: "04", name: "Planning & Execution", score: 3, target: 8, note: "No quarterly cadence. Priorities drift." },
    { n: "05", name: "Profit & Cash Flow", score: 5, target: 8, note: "Margin OK. Working capital tight." },
    { n: "06", name: "Revenue & Marketing", score: 4, target: 8, note: "Lead flow inconsistent. Conversion untracked." },
    { n: "07", name: "Operations & Delivery", score: 2, target: 8, note: "Tribal knowledge. Quality variable." },
    { n: "08", name: "Financials & Metrics", score: 5, target: 8, note: "Numbers exist. Not actioned weekly." },
    { n: "09", name: "Infrastructure & Systems", score: 3, target: 8, note: "Stack is messy. Documentation thin." },
    { n: "10", name: "Team & Leadership", score: 4, target: 8, note: "Hiring works. Leadership layer absent." },
  ];
  const colorFor = (s) => s <= 3 ? "#e11d48" : s <= 5 ? "#f59e0b" : s <= 7 ? "#1ca0c2" : "#10b981";
  return (
    <section className="pc-section" data-screen-label="Report / Heatmap" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 760, marginBottom: 40 }}>
          <span className="pc-eyebrow">10-Area Heatmap</span>
          <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(28px, 3.4vw, 40px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
            Where the business actually leaks.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#475569", margin: 0 }}>
            Each row is one of the 10 areas. The filled bar is your current score. The faint bar is best-in-class.
          </p>
        </div>
        <div className="reveal" style={{ background: "#fff", border: "1px solid var(--pc-slate-200)", borderRadius: 24, overflow: "hidden", boxShadow: "0 16px 48px -24px rgba(15,23,42,0.10)" }}>
          {areas.map((a, i) => (
            <div key={a.n} style={{
              display: "grid", gridTemplateColumns: "44px 1.4fr 1fr 48px 1.6fr",
              gap: 20, alignItems: "center",
              padding: "18px 24px",
              borderBottom: i < areas.length - 1 ? "1px solid var(--pc-slate-200)" : "none",
              background: i % 2 === 0 ? "#fff" : "#fafbfc",
            }} className="rp-area-row">
              <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>{a.n}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em" }}>{a.name}</div>
              <div style={{ position: "relative", height: 10, borderRadius: 9999, background: "#f1f5f9" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${a.target * 10}%`, borderRadius: 9999, background: "rgba(148,163,184,0.30)" }} />
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${a.score * 10}%`, borderRadius: 9999, background: colorFor(a.score), boxShadow: `0 0 0 1px ${colorFor(a.score)}` }} />
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: colorFor(a.score), textAlign: "right" }}>{a.score}/10</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.4 }}>{a.note}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 880px) { .rp-area-row { grid-template-columns: 36px 1fr auto !important; gap: 12px !important; } .rp-area-row > div:nth-child(3) { grid-column: 1 / -1; } .rp-area-row > div:nth-child(5) { grid-column: 1 / -1; } }`}</style>
    </section>
  );
}

// ============================================================
// Top 3 priorities — sequenced playbooks
// ============================================================
function TopPriorities() {
  const ps = [
    { n: "01", color: "#42a1ee", grad: "linear-gradient(135deg,#42a1ee,#1d6fb5)", area: "OPERATIONS & DELIVERY", title: "Document the Sales Process",
      why: "Your weakest area. Three reps, three different processes, no shared language. This is the single highest-leverage move on the board.",
      steps: ["Map the current process — every stage, every artefact", "Codify into a one-page playbook with templates", "Run a 30-min onboarding with each rep, plus 90-day review"],
      impact: "+8 BOSS pts est.", time: "30 days", roi: "£62K Yr 1" },
    { n: "02", color: "#1ca0c2", grad: "linear-gradient(135deg,#1ca0c2,#0e7490)", area: "PLANNING & EXECUTION", title: "Install a Weekly Cadence",
      why: "There is no rhythm. Priorities drift. The team plays catch-up. A 60-minute weekly leadership meeting will compound across every other area.",
      steps: ["Define 5 weekly metrics that matter", "Set up a Monday cockpit meeting + 1-page scoreboard", "Quarterly priorities + monthly review"],
      impact: "+6 BOSS pts est.", time: "14 days", roi: "£48K Yr 1" },
    { n: "03", color: "#10b981", grad: "linear-gradient(135deg,#10b981,#047857)", area: "OWNER PERFORMANCE", title: "Replace yourself in Delivery",
      why: "You're still on every project. Until that's fixed, every other gain is capped at the size of your week. Hire / promote one delivery lead.",
      steps: ["List your top 5 weekly delivery tasks", "Identify or hire one person for each", "30/60/90 handover plan with clear KPIs"],
      impact: "+5 BOSS pts est.", time: "60 days", roi: "£76K Yr 1" },
  ];
  return (
    <section className="pc-section" data-screen-label="Report / Priorities" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 760, marginBottom: 48 }}>
          <span className="pc-eyebrow">Your Top 3 · Next 90 Days</span>
          <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(28px, 3.4vw, 44px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.06, color: "#0f172a" }}>
            Three moves. <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#0c5290,#1ca0c2)", WebkitBackgroundClip: "text", color: "transparent" }}>In this order.</em>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#475569", margin: 0, maxWidth: 640 }}>
            Picked from 50 BOSS playbooks. Sequenced for highest ROI on the smallest effort, given where you actually are right now.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {ps.map((p) => (
            <div key={p.n} className="reveal pc-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="rp-pri-grid" style={{ display: "grid", gridTemplateColumns: "auto 1.4fr 1fr", gap: 0 }}>
                <div style={{ padding: "32px 28px", background: p.grad, color: "#fff", display: "flex", flexDirection: "column", gap: 10, justifyContent: "space-between", minWidth: 200 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.16em" }}>PRIORITY {p.n}</div>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.10em", marginTop: 4 }}>{p.area}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.95)" }}>
                    <div><strong style={{ fontSize: 14 }}>{p.impact}</strong></div>
                    <div style={{ opacity: 0.8 }}>{p.time}</div>
                    <div style={{ opacity: 0.8, marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.20)" }}>≈ {p.roi}</div>
                  </div>
                </div>
                <div style={{ padding: 32, borderRight: "1px solid var(--pc-slate-200)" }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: 24, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.02em" }}>{p.title}</h3>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#475569" }}>{p.why}</p>
                </div>
                <div style={{ padding: 32 }}>
                  <div className="pc-eyebrow" style={{ marginBottom: 14, fontSize: 11 }}>Three steps</div>
                  <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                    {p.steps.map((s, i) => (
                      <li key={i} style={{ display: "flex", gap: 12, fontSize: 14, lineHeight: 1.5, color: "#1e293b" }}>
                        <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: `${p.color}18`, color: p.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <a href="#" style={{ display: "inline-flex", marginTop: 16, fontSize: 13, fontWeight: 600, color: p.color, alignItems: "center", gap: 6, textDecoration: "none" }}>Open BOSS Playbook <Icon name="arrowRight" size={12} strokeWidth={2.5} /></a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .rp-pri-grid { grid-template-columns: 1fr !important; } .rp-pri-grid > div:nth-child(2) { border-right: none !important; border-bottom: 1px solid var(--pc-slate-200); } }`}</style>
    </section>
  );
}

// ============================================================
// 5 Levels — where you are
// ============================================================
function LevelMap() {
  const levels = [
    { n: "01", name: "OVERWHELMED", c: "#e11d48", desc: "Reactive. Cash tight." },
    { n: "02", name: "OVERWORKED", c: "#f59e0b", desc: "Real growth. You're still the engine.", here: true },
    { n: "03", name: "ORGANISED", c: "#1ca0c2", desc: "Systems hold. You can step out for a week.", next: true },
    { n: "04", name: "OVERSEER", c: "#0c5290", desc: "You lead leaders. Strategy compounds." },
    { n: "05", name: "OWNER", c: "#10b981", desc: "Asset, not job. You choose." },
  ];
  return (
    <section className="pc-section" data-screen-label="Report / Level map" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 760, marginBottom: 40 }}>
          <span className="pc-eyebrow">Your Level Path</span>
          <h2 style={{ margin: "16px 0 0", fontSize: "clamp(28px, 3.4vw, 40px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
            You're at <em style={{ fontStyle: "normal", fontWeight: 700, color: "#f59e0b" }}>Overworked</em>. Next stop: <em style={{ fontStyle: "normal", fontWeight: 700, color: "#1ca0c2" }}>Organised</em>.
          </h2>
        </div>
        <div className="reveal rp-levels" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {levels.map(l => (
            <div key={l.n} style={{
              padding: 20, borderRadius: 16,
              background: l.here ? "#fff" : (l.next ? "#fff" : "#fafbfc"),
              border: l.here ? `2px solid ${l.c}` : (l.next ? `1.5px dashed ${l.c}` : "1px solid var(--pc-slate-200)"),
              boxShadow: l.here ? `0 16px 32px -12px ${l.c}55` : "none",
              position: "relative",
            }}>
              {l.here && <span style={{ position: "absolute", top: -12, left: 16, padding: "3px 10px", fontSize: 10, fontWeight: 700, background: l.c, color: "#fff", borderRadius: 9999, letterSpacing: "0.16em" }}>YOU</span>}
              {l.next && <span style={{ position: "absolute", top: -12, left: 16, padding: "3px 10px", fontSize: 10, fontWeight: 700, background: "#fff", color: l.c, border: `1.5px solid ${l.c}`, borderRadius: 9999, letterSpacing: "0.16em" }}>NEXT</span>}
              <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: l.c, letterSpacing: "0.10em" }}>LV {l.n}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6, letterSpacing: "0.04em" }}>{l.name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.4 }}>{l.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 880px) { .rp-levels { grid-template-columns: 1fr 1fr !important; } } @media (max-width: 480px) { .rp-levels { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

// ============================================================
// Funnel multiplier — personal £ uplift
// ============================================================
function FunnelMath() {
  return (
    <section className="pc-section" data-screen-label="Report / Funnel" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="reveal" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 56, alignItems: "center" }} data-cls="rp-fn-grid">
          <div>
            <span className="pc-eyebrow">Your Funnel Multiplier</span>
            <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(28px, 3.4vw, 40px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
              <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#0c5290,#1ca0c2)", WebkitBackgroundClip: "text", color: "transparent" }}>+£186K</em> hiding in your existing funnel.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#475569", margin: "0 0 16px" }}>
              Five revenue levers run your business: leads, lead-to-appointment, close rate, deal value, transactions per customer per year.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#475569", margin: 0 }}>
              At your current numbers, a 10% improvement on each compounds to <strong style={{ color: "#0f172a" }}>1.61×</strong> your annual revenue. That's £186K — without spending another pound on marketing.
            </p>
          </div>
          <div style={{ background: "#fff", border: "1px solid var(--pc-slate-200)", borderRadius: 24, padding: 28, boxShadow: "0 16px 48px -24px rgba(15,23,42,0.10)" }}>
            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#0c5290", letterSpacing: "0.18em", marginBottom: 14 }}>YOUR FIVE LEVERS · CURRENT → +10%</div>
            {[
              { l: "Leads / month", a: "32", b: "35" },
              { l: "Lead → appointment", a: "30%", b: "33%" },
              { l: "Close rate", a: "40%", b: "44%" },
              { l: "Average deal", a: "£12,000", b: "£13,200" },
              { l: "Transactions / yr", a: "1.2", b: "1.32" },
            ].map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 14, alignItems: "center", padding: "12px 0", borderBottom: i < 4 ? "1px solid var(--pc-slate-200)" : "none" }}>
                <div style={{ fontSize: 13, color: "#334155" }}>{r.l}</div>
                <div className="mono" style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{r.a}</div>
                <Icon name="arrowRight" size={12} strokeWidth={2} />
                <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "#0c5290" }}>{r.b}</div>
              </div>
            ))}
            <div style={{ marginTop: 20, padding: "16px 18px", borderRadius: 14, background: "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(12,82,144,0.06))", border: "1px solid rgba(16,185,129,0.24)" }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#047857", letterSpacing: "0.16em", marginBottom: 4 }}>ANNUAL UPLIFT</div>
              <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.025em" }}>£1.8M → £2.99M <span style={{ fontSize: 14, color: "#047857" }}>(+£186K Yr 1)</span></div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { [data-cls="rp-fn-grid"] { grid-template-columns: 1fr !important; gap: 40px !important; } }`}</style>
    </section>
  );
}

// ============================================================
// Next steps CTA
// ============================================================
function ReportCTA() {
  return (
    <section style={{ padding: "120px 0", background: "linear-gradient(135deg,#0c5290 0%,#073157 60%,#061a2e 100%)", color: "#fff", position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.55, pointerEvents: "none", background: "radial-gradient(ellipse 60% 50% at 88% 18%, rgba(66,161,238,0.5), transparent 55%), radial-gradient(ellipse 50% 50% at 8% 80%, rgba(28,160,194,0.35), transparent 55%)" }} />
      <div className="pc-container" style={{ position: "relative" }}>
        <div className="reveal" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <span className="pc-eyebrow eyebrow-on-dark" style={{ color: "#9fbde7" }}>What now</span>
          <h2 style={{ margin: "16px 0 22px", fontSize: "clamp(34px, 4.4vw, 56px)", fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#fff" }}>
            Three options. <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#42a1ee,#34d399)", WebkitBackgroundClip: "text", color: "transparent" }}>You choose.</em>
          </h2>
        </div>
        <div className="reveal rp-cta-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 48 }}>
          {[
            { n: "01", t: "Take it on yourself", body: "Download the report. Share with your team. Start with priority 01.", cta: "↓ Download PDF", solid: false },
            { n: "02", t: "Book a 20-min review", body: "Walk through your report with a Profit Coach. No pitch script. No upsell.", cta: "Book review →", solid: true },
            { n: "03", t: "Re-take in 90 days", body: "Run the diagnostic again. Compare wheels. See what moved.", cta: "Set reminder", solid: false },
          ].map((o) => (
            <div key={o.n} style={{ padding: 28, borderRadius: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#9fbde7", letterSpacing: "0.16em" }}>OPTION {o.n}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{o.t}</div>
              <div style={{ fontSize: 14, color: "#cfdef3", lineHeight: 1.55, marginBottom: 6 }}>{o.body}</div>
              <a href="#" className={o.solid ? "rp-chip rp-chip--solid" : "rp-chip"} style={{ marginTop: "auto", textAlign: "center", padding: "12px 18px", textDecoration: "none" }}>{o.cta}</a>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 880px) { .rp-cta-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

window.ReportHeader = ReportHeader;
window.SnapshotRow = SnapshotRow;
window.AreasHeatmap = AreasHeatmap;
window.TopPriorities = TopPriorities;
window.LevelMap = LevelMap;
window.FunnelMath = FunnelMath;
window.ReportCTA = ReportCTA;
