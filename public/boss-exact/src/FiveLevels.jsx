/* global React, Icon */
const { useState: useStateL } = React;

// The 5 Levels — interactive centerpiece
const LEVELS = [
  {
    n: "01", id: "overwhelmed", name: "Overwhelmed",
    color: "#e11d48", soft: "#fee2e2", grad: "linear-gradient(135deg,#e11d48,#9f1239)",
    headline: "Drowning. Reactive. The business runs you.",
    description: "Cash is tight. Days are spent firefighting. Strategy is whatever's loudest this week. The owner is in every conversation, every decision, every problem.",
    feels: ["Working 60+ hours and falling further behind", "No real visibility into the numbers", "Every problem comes back to the owner", "Cash flow lurches month to month"],
    devil: "The devil at this level is survival. Fixing one fire reveals three more.",
    fix: "Install the basics: a weekly cadence, real numbers, the top three priorities for the next 90 days. Stop the bleed before you build.",
    bossRange: "0–25",
  },
  {
    n: "02", id: "overworked", name: "Overworked",
    color: "#f59e0b", soft: "#fef3c7", grad: "linear-gradient(135deg,#f59e0b,#b45309)",
    headline: "Working hard, getting somewhere. But you are still the engine.",
    description: "Revenue is real. The team is hired. But the owner is still the one selling, delivering, hiring, fixing. Holidays come with a phone. Decisions still funnel back.",
    feels: ["Most decisions still come to your desk", "You can take a day off — never a fortnight", "Growth is happening, but proportional to your hours", "You've delegated tasks. You haven't delegated outcomes."],
    devil: "The devil at this level is identity. The business needs you to stop being indispensable — and you've built a self-image around being indispensable.",
    fix: "Document the work. Promote one person to own one thing entirely. Replace yourself in one function. Then the next.",
    bossRange: "26–45",
  },
  {
    n: "03", id: "organised", name: "Organised",
    color: "#1ca0c2", soft: "#cffafe", grad: "linear-gradient(135deg,#1ca0c2,#0e7490)",
    headline: "The systems are in. Most weeks, the business runs.",
    description: "There's a marketing engine. There's a sales process. The team has roles and KPIs. Cash flow is predictable. Profit is a number you watch, not guess.",
    feels: ["You can take a real holiday", "The team handles 80% of decisions without you", "Numbers are reviewed weekly, not panic-checked", "You spend most of your week on the right things"],
    devil: "The devil at this level is comfort. The business works — and 'works' is enough to stop pushing. Many owners camp here for years.",
    fix: "Move from running the business to leading it. Build a leadership team. Set a 3-year orbit. Stop solving problems your managers should solve.",
    bossRange: "46–65",
  },
  {
    n: "04", id: "overseer", name: "Overseer",
    color: "#0c5290", soft: "#cfdef3", grad: "linear-gradient(135deg,#0c5290,#073157)",
    headline: "You lead the leaders. The business compounds without you in the room.",
    description: "Departments are owned by managers. Strategy is set, cascaded, executed, and reviewed. Margin is up. The owner works on the business, not in it — and is genuinely valuable rather than busy.",
    feels: ["You spend most of your time on people, strategy, and capital", "Profit grows faster than revenue", "The team has its own leaders and meetings", "You could step out for a month with a phone off"],
    devil: "The devil at this level is succession. The business runs without you in the room — but doesn't yet run without you in the company.",
    fix: "Build the next layer. Choose successors. Install governance. Make the business an asset, not a job.",
    bossRange: "66–85",
  },
  {
    n: "05", id: "owner", name: "Owner",
    color: "#10b981", soft: "#d1fae5", grad: "linear-gradient(135deg,#10b981,#047857)",
    headline: "You own an asset. You don't run a job.",
    description: "The business creates value whether you're there or not. You choose how involved to be. There's a board, a leadership team, a clear three-year picture. You can sell, scale, or step away.",
    feels: ["The business is genuinely sellable at a real multiple", "Your time is yours — by design, not exception", "You're the chair, not the operator", "Your wealth is no longer locked inside the company"],
    devil: "The devil at this level is purpose. Every owner has to answer 'what now?' once the business no longer needs them.",
    fix: "Decide what you want from the asset you've built. Hold, sell, scale, or transition. The system you installed gives you the freedom to choose.",
    bossRange: "86–100",
  },
];

function FiveLevels() {
  const [active, setActive] = useStateL("overworked"); // start where most owners are
  const lvl = LEVELS.find(l => l.id === active);
  return (
    <section id="five-levels" className="pc-section" style={{ background: "var(--bg-canvas)", position: "relative" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 760, marginBottom: 48 }}>
          <span className="pc-eyebrow">The 5 Levels</span>
          <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(32px, 4.4vw, 52px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.06, color: "#0f172a" }}>
            Every owner moves through five levels.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.65, color: "#475569", margin: 0 }}>
            From <strong style={{ color: "#0f172a", fontWeight: 600 }}>Overwhelmed</strong> to <strong style={{ color: "#0f172a", fontWeight: 600 }}>Owner</strong> — every level has its own challenges, its own devil,
            and its own way out. A Profit Coach knows where you are, what to install next, and what to leave for the level after that.
          </p>
        </div>

        {/* Stage selector — horizontal stepper with connecting rail */}
        <div className="reveal pc-levels-strip" style={{ marginBottom: 32, position: "relative" }}>
          {/* Connecting rail (desktop) */}
          <div className="pc-rail" aria-hidden="true" style={{
            position: "absolute", left: "10%", right: "10%", top: 26, height: 3,
            background: "linear-gradient(90deg,#e11d48 0%,#f59e0b 25%,#1ca0c2 50%,#0c5290 75%,#10b981 100%)",
            opacity: 0.35, borderRadius: 9999, zIndex: 0,
          }} />
          <div className="pc-rail-fill" aria-hidden="true" style={{
            position: "absolute", left: "10%", top: 26, height: 3,
            width: `${(LEVELS.findIndex(l=>l.id===active)) * 20 + 0}%`,
            background: lvl.grad, borderRadius: 9999, zIndex: 0,
            transition: "width 350ms var(--ease-out)",
          }} />

          <div className="pc-levels-row" style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
            position: "relative", zIndex: 1,
          }}>
            {LEVELS.map((l) => {
              const isActive = active === l.id;
              return (
                <button key={l.id} onClick={() => setActive(l.id)} aria-pressed={isActive}
                  className="pc-level-btn"
                  style={{
                    background: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                    border: isActive ? `1.5px solid ${l.color}` : "1px solid var(--pc-slate-200)",
                    borderRadius: 18, padding: "14px 14px 16px",
                    textAlign: "center", cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    boxShadow: isActive ? `0 18px 40px -16px ${l.color}88` : "0 2px 6px -2px rgba(15,23,42,0.06)",
                    transition: "all 220ms var(--ease-out)",
                    position: "relative",
                    transform: isActive ? "translateY(-2px)" : "translateY(0)",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 9999,
                    background: isActive ? l.grad : "#fff",
                    border: isActive ? "none" : `2px solid ${l.color}`,
                    color: isActive ? "#fff" : l.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 16, letterSpacing: "0.02em",
                    transition: "all 220ms var(--ease-out)",
                    boxShadow: isActive ? `0 12px 24px -8px ${l.color}aa` : "none",
                  }}>{l.n}</div>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: isActive ? "#0f172a" : "#334155",
                    letterSpacing: "-0.01em", marginTop: 2,
                  }}>{l.name}</div>
                  <div className="mono" style={{
                    fontSize: 10, color: isActive ? l.color : "#94a3b8", fontWeight: 600, letterSpacing: "0.10em",
                  }}>BOSS {l.bossRange}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active level detail */}
        <div className="reveal pc-level-panel" style={{
          background: "#fff", borderRadius: 28,
          border: "1px solid var(--pc-slate-200)",
          borderTop: `4px solid ${lvl.color}`,
          padding: 0, overflow: "hidden",
          boxShadow: "0 24px 80px -32px rgba(15,23,42,0.18)",
          display: "grid", gridTemplateColumns: "1.1fr 1fr",
          transition: "border-color 300ms ease",
        }} key={lvl.id}>
          <div style={{ padding: "48px 48px 48px 48px", borderRight: "1px solid var(--pc-slate-200)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: lvl.grad, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 18, letterSpacing: "0.02em",
                boxShadow: `0 16px 32px -12px ${lvl.color}88`,
              }}>{lvl.n}</div>
              <div>
                <div className="mono" style={{ fontSize: 11, color: lvl.color, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" }}>Level {lvl.n}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>{lvl.name}</div>
              </div>
            </div>
            <h3 style={{ margin: "0 0 16px", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "#0f172a", lineHeight: 1.2 }}>
              {lvl.headline}
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 16, lineHeight: 1.65, color: "#475569" }}>
              {lvl.description}
            </p>
            <div style={{
              padding: "16px 18px", borderRadius: 12,
              background: lvl.soft, border: `1px solid ${lvl.color}33`,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <div style={{ flexShrink: 0, marginTop: 2, color: lvl.color }}>
                <Icon name="trending" size={18} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: lvl.color, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>The Devil at this Level</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: "#1e293b", fontWeight: 500 }}>{lvl.devil}</div>
              </div>
            </div>
          </div>
          <div style={{ padding: 48, background: "#fafbfc" }}>
            <div className="pc-eyebrow" style={{ marginBottom: 14 }}>What it feels like</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {lvl.feels.map((f, i) => (
                <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, color: "#1e293b", lineHeight: 1.5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 9999, background: lvl.color, marginTop: 9, flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px dashed var(--pc-slate-300)" }}>
              <div className="pc-eyebrow" style={{ marginBottom: 12 }}>What a Profit Coach installs</div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#334155" }}>{lvl.fix}</p>
            </div>
          </div>
        </div>

        {/* Honest note about pace */}
        <div className="reveal" style={{
          marginTop: 32, textAlign: "center", maxWidth: 720, marginInline: "auto",
          fontSize: 15, color: "#64748b", lineHeight: 1.6,
        }}>
          A coach typically works with an owner across multiple levels — because every level has its own devil, and the next one only reveals itself once the current one is genuinely solved.
        </div>
      </div>
      <style>{`
        .pc-level-btn:hover { transform: translateY(-3px) !important; box-shadow: 0 14px 28px -12px rgba(15,23,42,0.18) !important; }
        @media (max-width: 880px) {
          .pc-rail, .pc-rail-fill { display: none !important; }
          .pc-levels-row { grid-template-columns: 1fr 1fr 1fr !important; gap: 6px !important; }
          .pc-level-btn { padding: 10px 6px 12px !important; }
          .pc-level-btn > div:first-child { width: 40px !important; height: 40px !important; font-size: 13px !important; }
          .pc-level-btn > div:nth-child(2) { font-size: 13px !important; }
          .pc-level-panel { grid-template-columns: 1fr !important; }
          .pc-level-panel > div:first-child { border-right: none !important; border-bottom: 1px solid var(--pc-slate-200) !important; padding: 32px !important; }
          .pc-level-panel > div:last-child { padding: 32px !important; }
        }
      `}</style>
    </section>
  );
}

window.FiveLevels = FiveLevels;
window.LEVELS = LEVELS;
