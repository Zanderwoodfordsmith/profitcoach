/* global React, Icon, BossWheel */
const { useState: useStateB, useEffect: useEffectB } = React;

// ============================================================
// BOSS Assessment Landing — Hero
// ============================================================
function BossHero() {
  return (
    <section style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg,#0c5290 0%,#073157 55%,#061a2e 100%)",
      color: "#fff", paddingTop: 96, paddingBottom: 96,
    }}>
      {/* ambient blobs */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.55,
        background: "radial-gradient(ellipse 60% 50% at 88% 18%, rgba(66,161,238,0.55), transparent 55%), radial-gradient(ellipse 50% 50% at 8% 80%, rgba(28,160,194,0.4), transparent 55%), radial-gradient(ellipse 30% 40% at 50% 100%, rgba(16,185,129,0.18), transparent 60%)" }} />
      {/* subtle grid */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent 80%)" }} />

      <div className="pc-container" style={{ position: "relative" }}>
        <div className="boss-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 72, alignItems: "center" }}>
          <div className="reveal">
            <div style={{
              display: "inline-flex", gap: 10, alignItems: "center",
              padding: "5px 14px 5px 5px", borderRadius: 9999,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(12px)", fontSize: 12, fontWeight: 600, color: "#cfdef3", letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}>
              <span style={{ background: "#10b981", color: "#fff", padding: "3px 10px", borderRadius: 9999, fontSize: 10, letterSpacing: "0.2em", fontWeight: 700 }}>FREE · 10 MIN</span>
              The BOSS Diagnostic
            </div>

            <h1 style={{
              margin: "26px 0 22px",
              fontSize: "clamp(40px, 5.6vw, 80px)", lineHeight: 1.0, fontWeight: 300,
              letterSpacing: "-0.04em", color: "#fff",
            }}>
              In 10 minutes,<br />
              you'll know{" "}
              <em style={{
                fontStyle: "normal", fontWeight: 700,
                background: "linear-gradient(135deg,#42a1ee,#1ca0c2,#34d399)",
                WebkitBackgroundClip: "text", color: "transparent",
                display: "inline-block",
              }}>where the business actually leaks</em>.
            </h1>

            <p style={{ fontSize: 23, lineHeight: 1.6, color: "#cfdef3", margin: "0 0 32px", maxWidth: 560 }}>
              50 questions. 10 areas of business. One score that tells you exactly where you are — and the three highest-leverage moves for the next 90 days. No call. No pitch.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 32 }}>
              <a href="#start" className="boss-cta-primary" onClick={(e) => window.bossSmoothScrollTo("start", e)}>
                Start the Diagnostic
                <Icon name="arrowRight" size={16} strokeWidth={2.25} />
              </a>
              <a href="#whats-inside" className="boss-cta-ghost" onClick={(e) => window.bossSmoothScrollTo("whats-inside", e)}>See what's inside</a>
            </div>

            {/* trust strip */}
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
              {[
                ["10 mins", "to complete"],
                ["50 Qs", "across 10 areas"],
                ["£0", "no credit card"],
                ["1 page", "actionable plan"],
              ].map((t, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{t[0]}</div>
                  <div style={{ fontSize: 16, color: "#9fbde7", letterSpacing: "0.02em" }}>{t[1]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: layered visual — stylised report mock */}
          <div className="reveal" style={{ position: "relative", display: "flex", justifyContent: "center", minHeight: 540 }}>
            <BossReportMock />
          </div>
        </div>
      </div>

      <style>{`
        .boss-cta-primary {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--font-sans); font-weight: 700; font-size: 16px;
          padding: 18px 30px; border-radius: 9999px; text-decoration: none;
          background: linear-gradient(135deg,#10b981,#047857);
          color: #fff;
          box-shadow: 0 20px 44px -14px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.2);
          transition: filter 200ms var(--ease-out), box-shadow 200ms var(--ease-out), transform 100ms var(--ease-out);
        }
        .boss-cta-primary:hover { filter: brightness(1.08); box-shadow: 0 24px 50px -14px rgba(16,185,129,0.7), inset 0 1px 0 rgba(255,255,255,0.25); }
        .boss-cta-primary:active { transform: scale(0.98); }
        .boss-cta-ghost {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--font-sans); font-weight: 600; font-size: 16px;
          padding: 18px 24px; border-radius: 9999px; text-decoration: none;
          color: #fff; border: 1px solid rgba(255,255,255,0.20);
          background: rgba(255,255,255,0.04); backdrop-filter: blur(10px);
          transition: background 200ms var(--ease-out), border-color 200ms var(--ease-out);
        }
        .boss-cta-ghost:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.4); }

        @media (max-width: 980px) {
          .boss-hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
      `}</style>
    </section>
  );
}

// Stylised "your report" mock — the visual proof of value above the fold
function BossReportMock() {
  // animate the gauge fill on mount
  const [score, setScore] = useStateB(0);
  useEffectB(() => {
    let v = 0;
    const t = setInterval(() => {
      v += 2;
      setScore(Math.min(v, 47));
      if (v >= 47) clearInterval(t);
    }, 22);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 520 }}>
      {/* Floating BOSS Wheel card — back layer */}
      <div style={{
        position: "absolute", left: -40, top: 30, zIndex: 1,
        width: 320, padding: 18,
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        boxShadow: "0 24px 64px -20px rgba(0,0,0,0.5)",
        transform: "rotate(-4deg)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9fbde7", letterSpacing: "0.18em" }}>YOUR BOSS WHEEL</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#34d399", letterSpacing: "0.10em" }}>10 AREAS</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: 4 }}>
          <BossWheel size={260} animated={false} showLabels={false} />
        </div>
      </div>

      {/* Foreground "Score" card */}
      <div style={{
        position: "relative", zIndex: 2,
        marginLeft: "auto", width: 360,
        padding: 28,
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
        backdropFilter: "blur(24px)",
        borderRadius: 28,
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.55)",
        transform: "translateY(40px) rotate(2deg)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#9fbde7", letterSpacing: "0.20em" }}>BOSS SCORE</div>
            <div style={{ fontSize: 11, color: "#cfdef3", marginTop: 4 }}>Out of 100 · Updated live</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 9999, background: "rgba(245,158,11,0.18)", color: "#fbbf24", letterSpacing: "0.16em" }}>LEVEL 02</span>
        </div>

        {/* big number */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 22 }}>
          <div className="mono" style={{
            fontSize: 84, fontWeight: 700, lineHeight: 1, color: "#fff",
            letterSpacing: "-0.04em",
            background: "linear-gradient(135deg,#fff,#cfdef3)",
            WebkitBackgroundClip: "text", color: "transparent",
          }}>{score}</div>
          <div style={{ fontSize: 22, color: "#9fbde7", fontWeight: 400 }}>/100</div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, color: "#34d399", fontWeight: 600, fontSize: 13 }}>
            <Icon name="trending" size={14} strokeWidth={2.5} />
            +18 in 90d
          </div>
        </div>

        {/* gauge */}
        <div style={{ height: 8, borderRadius: 9999, background: "rgba(255,255,255,0.10)", overflow: "hidden", marginBottom: 22 }}>
          <div style={{ width: score + "%", height: "100%", background: "linear-gradient(90deg,#e11d48,#f59e0b 25%,#1ca0c2 50%,#0c5290 75%,#10b981)", transition: "width 60ms ease-out" }} />
        </div>

        {/* mini list */}
        <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#9fbde7", letterSpacing: "0.18em", marginBottom: 12 }}>YOUR TOP 3 PRIORITIES</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { c: "#42a1ee", t: "Document the Sales Process" },
            { c: "#1ca0c2", t: "Install a Weekly Cadence" },
            { c: "#10b981", t: "Replace yourself in Delivery" },
          ].map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, background: p.c, color: "#fff", fontWeight: 700, fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{(i+1).toString().padStart(2,"0")}</span>
              <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{p.t}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#34d399", fontWeight: 700, letterSpacing: "0.06em" }}>HIGH ROI</span>
            </div>
          ))}
        </div>
      </div>

      {/* tiny gain badge */}
      <div style={{
        position: "absolute", right: -10, top: -10, zIndex: 3,
        padding: "10px 16px", borderRadius: 14,
        background: "linear-gradient(135deg,#34d399,#10b981)",
        color: "#fff", fontWeight: 700, fontSize: 13,
        boxShadow: "0 16px 32px -10px rgba(16,185,129,0.7)",
        transform: "rotate(6deg)",
        display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}>
        <div className="mono" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>+£186K</div>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", opacity: 0.9, whiteSpace: "nowrap" }}>YR 1 UPLIFT</div>
      </div>
    </div>
  );
}

window.BossHero = BossHero;
