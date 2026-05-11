/* global React, Icon, BossWheel */

function Hero() {
  return (
    <section style={{
      position: "relative", overflow: "hidden",
      background: `
        radial-gradient(ellipse 70% 60% at 18% 12%, rgba(66,161,238,0.18), transparent 60%),
        radial-gradient(ellipse 60% 50% at 92% 28%, rgba(13,148,136,0.13), transparent 55%),
        #f5f8fc`,
      paddingTop: 96, paddingBottom: 120,
    }}>
      {/* Subtle grid backdrop — echoes the 10×5 BOSS grid */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(12,82,144,0.04) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(12,82,144,0.04) 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
        maskImage: "radial-gradient(ellipse 70% 80% at 50% 30%, #000 40%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 50% 30%, #000 40%, transparent 80%)",
      }} />

      <div className="pc-container" style={{ position: "relative" }}>
        <div className="pc-hero-grid" style={{
          display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 64, alignItems: "center",
        }}>
          <div className="reveal">
            <div style={{
              display: "inline-flex", gap: 10, alignItems: "center",
              padding: "6px 16px 6px 6px", borderRadius: 9999,
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(12,82,144,0.10)",
              backdropFilter: "blur(8px)",
              fontSize: 12, fontWeight: 600, color: "#0c5290",
              letterSpacing: "0.05em",
            }}>
              <span style={{
                background: "#0c5290", color: "#fff",
                padding: "3px 10px", borderRadius: 9999,
                fontSize: 10, letterSpacing: "0.2em",
              }}>ONE-TO-ONE</span>
              Business coaching for owners doing £200K–£5M
            </div>

            <h1 style={{
              margin: "26px 0 22px",
              fontSize: "clamp(40px, 5.4vw, 76px)",
              lineHeight: 1.02, fontWeight: 300,
              letterSpacing: "-0.035em", color: "#0f172a",
              maxWidth: "14ch",
            }}>
              Transform your business.<br />
              <em style={{
                fontStyle: "normal", fontWeight: 700,
                background: "linear-gradient(135deg,#0c5290 0%,#1ca0c2 60%,#42a1ee 100%)",
                WebkitBackgroundClip: "text", color: "transparent",
              }}>Reclaim your life.</em>
            </h1>

            <p style={{
              fontSize: 19, lineHeight: 1.6, color: "#475569",
              maxWidth: 540, margin: "0 0 36px",
            }}>
              Personalised one-to-one coaching from a certified Profit Coach who knows your numbers,
              your priorities, and your people — and runs a proven system to put more profit, time,
              and freedom back where it belongs.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <a href="#" className="pc-btn pc-btn--primary">
                Take the BOSS Diagnostic <Icon name="arrowRight" size={16} strokeWidth={2.25} />
              </a>
              <a href="#" className="pc-btn pc-btn--secondary">Speak to a Coach</a>
            </div>

            <div style={{
              display: "flex", flexWrap: "wrap", gap: 20, marginTop: 32,
              fontSize: 13, fontWeight: 500, color: "#64748b",
            }}>
              <span>· Free · 10 minutes · Personalised report</span>
            </div>
          </div>

          {/* Right: Glass BOSS preview card */}
          <div className="reveal" style={{
            position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: "-40px -40px 40px 40px",
              background: "radial-gradient(circle, rgba(66,161,238,0.20), transparent 65%)",
              pointerEvents: "none", zIndex: 0,
            }} />
            <div style={{
              position: "relative", zIndex: 1,
              background: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.65)",
              borderRadius: 32, padding: 28,
              boxShadow: "0 30px 80px -24px rgba(12,82,144,0.35), inset 0 1px 0 rgba(255,255,255,0.7)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <div className="pc-eyebrow" style={{ fontSize: 11 }}>The BOSS Diagnostic</div>
                  <div style={{ fontSize: 14, color: "#475569", marginTop: 4, fontWeight: 500 }}>
                    Acme Manufacturing · Q1 baseline
                  </div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600, padding: "5px 10px",
                  borderRadius: 9999, background: "rgba(16,185,129,0.12)",
                  color: "#047857", letterSpacing: "0.06em",
                }}>LIVE SAMPLE</div>
              </div>

              <BossWheel size={420} showLabels={true} withTarget={true} />

              <div style={{
                marginTop: 8, padding: 16, borderRadius: 16,
                background: "rgba(241,245,249,0.6)",
                border: "1px solid rgba(15,23,42,0.05)",
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
              }}>
                <Stat label="Stage" value="Organised" tone="primary" />
                <Stat label="Strongest" value="Owner" tone="green" />
                <Stat label="Weakest" value="Value & Exit" tone="red" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .pc-hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
      `}</style>
    </section>
  );
}

function Stat({ label, value, tone = "primary" }) {
  const colour = tone === "green" ? "#047857" : tone === "red" ? "#be123c" : "#0c5290";
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: colour, marginTop: 4, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

// ====== Section 2 — Sub-hero — 30–130% ======
function SubHero() {
  return (
    <section className="pc-section" style={{ background: "#fff", borderTop: "1px solid #eaf0f7" }}>
      <div className="pc-container" style={{ textAlign: "center" }}>
        <div className="reveal">
          <span className="pc-eyebrow">The Profit Promise</span>
          <h2 style={{
            margin: "20px auto 0", maxWidth: 880,
            fontSize: "clamp(34px, 4.4vw, 56px)", fontWeight: 300,
            letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a",
          }}>
            Unlock <span className="mono" style={{
              fontWeight: 700,
              background: "linear-gradient(135deg,#0c5290 0%,#1ca0c2 80%)",
              WebkitBackgroundClip: "text", color: "transparent",
              fontFeatureSettings: '"tnum" 1, "lnum" 1',
              fontFamily: "var(--font-sans)",
              letterSpacing: "-0.045em",
            }}>30–130%</span> more profit
            <br />in just 12 months.
          </h2>
          <p style={{
            fontSize: 19, lineHeight: 1.6, color: "#475569",
            maxWidth: 720, margin: "26px auto 0",
          }}>
            A certified Profit Coach helps you find the hidden profit in your business — and builds
            the plan to capture it. <strong style={{ color: "#0f172a", fontWeight: 600 }}>One coach. One system.
            One business that finally pays you back.</strong>
          </p>

          <a href="#" style={{
            display: "inline-flex", alignItems: "center", gap: 14,
            marginTop: 44, padding: "14px 28px 14px 14px",
            background: "rgba(245,248,252,0.7)",
            border: "1px solid rgba(12,82,144,0.10)",
            borderRadius: 9999, textDecoration: "none",
            transition: "all 200ms var(--ease-out)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "rgba(12,82,144,0.25)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(245,248,252,0.7)"; e.currentTarget.style.borderColor = "rgba(12,82,144,0.10)"; }}>
            <span style={{
              width: 44, height: 44, borderRadius: 9999,
              background: "linear-gradient(135deg,#0c5290,#063056)",
              color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 20px -6px rgba(12,82,144,0.5)",
            }}><Icon name="play" size={14} strokeWidth={0} style={{ fill: "#fff", transform: "translateX(1px)" }} /></span>
            <span style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0c5290" }}>Watch the 2-minute overview</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>How the Profit System works</span>
            </span>
          </a>
        </div>

        {/* Source-of-the-number footnote */}
        <div className="reveal" style={{
          marginTop: 56, display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0,
          maxWidth: 940, marginInline: "auto",
          borderTop: "1px solid #eaf0f7", borderBottom: "1px solid #eaf0f7",
        }}>
          {[
            ["+30%", "Owners running a 12-month engagement, baseline cohort"],
            ["+72%", "Owners completing the full Profit System install"],
            ["+130%", "Owners reaching Stage 04 — Optimised — and beyond"],
          ].map(([num, label], i) => (
            <div key={num} style={{
              padding: "28px 24px",
              borderLeft: i === 0 ? "none" : "1px solid #eaf0f7",
            }}>
              <div className="mono" style={{
                fontSize: 32, fontWeight: 700, color: "#0c5290",
                letterSpacing: "-0.03em", lineHeight: 1,
              }}>{num}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .pc-section .pc-container > div > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
          .pc-section .pc-container > div > div[style*="grid-template-columns"] > div { border-left: none !important; border-top: 1px solid #eaf0f7 !important; }
        }
      `}</style>
    </section>
  );
}

// ====== Section 3 — Outcome band ======
function OutcomeBand() {
  const items = [
    { icon: "pound", label: "More Profit" },
    { icon: "unlock", label: "More Freedom" },
    { icon: "clock", label: "More Time" },
    { icon: "users", label: "Stronger Team" },
    { icon: "trending", label: "Predictable Revenue" },
    { icon: "compass", label: "Clearer Strategy" },
  ];
  return (
    <section style={{
      background: "#0c5290",
      backgroundImage: "linear-gradient(135deg,#0c5290 0%,#073157 60%,#061a2e 100%)",
      padding: "40px 0",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      overflow: "hidden",
    }}>
      <div className="pc-container">
        <div className="pc-outcome-row" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 24, flexWrap: "nowrap",
        }}>
          {items.map((it, i) => (
            <React.Fragment key={it.label}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 12,
                color: "#fff", whiteSpace: "nowrap",
              }}>
                <span style={{ color: "#42a1ee" }}><Icon name={it.icon} size={20} /></span>
                <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{it.label}</span>
              </div>
              {i < items.length - 1 && (
                <span aria-hidden="true" style={{
                  width: 5, height: 5, borderRadius: 9999, background: "#42a1ee", flexShrink: 0,
                }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 880px) {
          .pc-outcome-row { overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin; }
        }
      `}</style>
    </section>
  );
}

Object.assign(window, { Hero, SubHero, OutcomeBand });
