/* global React, Icon, BossWheel */

// ====== Section 7 — The Profit System (with BOSS Wheel) ======
function ProfitSystem() {
  return (
    <section id="profit-system" className="pc-section" style={{
      background: "linear-gradient(135deg,#0c5290 0%,#073157 60%,#061a2e 100%)",
      color: "#fff", position: "relative", overflow: "hidden",
    }}>
      {/* Ambient glow */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none",
        background: "radial-gradient(circle at 80% 20%, rgba(66,161,238,0.4), transparent 50%), radial-gradient(circle at 15% 80%, rgba(28,160,194,0.3), transparent 55%)",
      }} />
      <div className="pc-container" style={{ position: "relative" }}>
        <div className="pc-system-grid" style={{
          display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 80, alignItems: "center",
        }}>
          <div className="reveal">
            <span className="pc-eyebrow eyebrow-on-dark" style={{ color: "#9fbde7" }}>The Profit System</span>
            <h2 style={{
              margin: "16px 0 24px",
              fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 300,
              letterSpacing: "-0.035em", lineHeight: 1.06, color: "#fff",
            }}>Built on the world's best business thinking.</h2>
            <p style={{ fontSize: 18, lineHeight: 1.65, color: "#cfdef3", margin: "0 0 18px" }}>
              The Profit System is the operating methodology every certified Profit Coach uses with their clients.
              It maps the work of <strong style={{ color: "#fff" }}>25+ of the world's leading business thinkers</strong> —
              Hormozi, Gerber, Michalowicz, Harnish, and more — into one connected system.
            </p>

            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16,
              margin: "32px 0 28px",
            }}>
              {[
                ["10", "areas of business"],
                ["5", "performance levels"],
                ["50", "playbooks"],
              ].map(([n, l]) => (
                <div key={l} style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(14px)",
                  borderRadius: 16, padding: 18,
                }}>
                  <div className="mono" style={{
                    fontSize: 36, fontWeight: 700, color: "#fff",
                    letterSpacing: "-0.04em", lineHeight: 1,
                  }}>{n}</div>
                  <div style={{ fontSize: 12, color: "#9fbde7", marginTop: 6, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#cfdef3", margin: "0 0 32px", maxWidth: 520 }}>
              One BOSS Diagnostic. One score. One clear roadmap of what to fix first —
              delivered one-to-one by a coach who knows your numbers, your priorities, and your people.
            </p>

            <a href="#" style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              fontSize: 15, fontWeight: 600, color: "#fff",
              padding: "14px 24px", borderRadius: 9999,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.20)",
              backdropFilter: "blur(12px)",
              textDecoration: "none",
            }}>Learn About The Profit System <Icon name="arrowRight" size={16} strokeWidth={2.25} /></a>
          </div>

          <div className="reveal" style={{ position: "relative" }}>
            <div style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(20px)",
              borderRadius: 32, padding: 32,
              boxShadow: "0 30px 80px -24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <div className="pc-eyebrow eyebrow-on-dark" style={{ color: "#9fbde7", fontSize: 11 }}>BOSS Diagnostic</div>
                  <div style={{ fontSize: 14, color: "#cfdef3", marginTop: 4 }}>Sample report — 10 areas scored</div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600, padding: "5px 10px",
                  borderRadius: 9999, background: "rgba(16,185,129,0.18)",
                  color: "#34d399", letterSpacing: "0.06em", height: "fit-content",
                }}>10 MIN</div>
              </div>
              <div style={{ filter: "drop-shadow(0 0 24px rgba(66,161,238,0.25))" }}>
                <BossWheelDark size={460} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) { .pc-system-grid { grid-template-columns: 1fr !important; gap: 56px !important; } }
      `}</style>
    </section>
  );
}

// Dark variant of BossWheel — labels in light tones
function BossWheelDark({ size = 460 }) {
  const { useEffect, useRef, useState } = React;
  const cx = size / 2, cy = size / 2, padding = 90;
  const r = (size / 2) - padding;
  const areas = window.BOSS_AREAS;
  const N = areas.length;
  const angles = Array.from({ length: N }, (_, i) => (-Math.PI / 2) + (i * 2 * Math.PI / N));
  const [t, setT] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let raf, started = null;
    const dur = 1400; let triggered = false;
    const start = () => {
      if (triggered) return; triggered = true;
      const tick = (ts) => {
        if (started == null) started = ts;
        const k = Math.min(1, (ts - started) / dur);
        setT(1 - Math.pow(1 - k, 3));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => entries.forEach(e => { if (e.isIntersecting) start(); }), { threshold: 0.25 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const pt = (rad, ang) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const scorePts = areas.map((a, i) => pt(r * (a.score / 100) * t, angles[i]));
  const targetPts = areas.map((_, i) => pt(r * 0.9, angles[i]));
  const path = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';
  const avg = Math.round(areas.reduce((s, a) => s + a.score, 0) / areas.length);

  return (
    <div ref={ref} style={{ width: size, maxWidth: "100%", margin: "0 auto" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <radialGradient id="bwd-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#42a1ee" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0c5290" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        {rings.map((rr, i) => (
          <circle key={rr} cx={cx} cy={cy} r={r * rr}
            fill={i === rings.length - 1 ? "rgba(255,255,255,0.02)" : "none"}
            stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray={i === rings.length - 1 ? "0" : "3 4"} />
        ))}
        {angles.map((a, i) => {
          const [x2, y2] = pt(r, a);
          return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(255,255,255,0.10)" />;
        })}
        <path d={path(targetPts)} fill="none" stroke="#10b981" strokeWidth="1.25" strokeDasharray="4 4" opacity={0.6 * t} />
        <path d={path(scorePts)} fill="url(#bwd-fill)" stroke="#42a1ee" strokeWidth="2" strokeLinejoin="round" />
        {scorePts.map((p, i) => {
          const v = areas[i].score;
          const c = v >= 65 ? "#34d399" : v >= 45 ? "#fbbf24" : "#fb7185";
          return <circle key={i} cx={p[0]} cy={p[1]} r={4.5} fill="#0c5290" stroke={c} strokeWidth="2" opacity={t} />;
        })}
        <circle cx={cx} cy={cy} r={3} fill="#42a1ee" />
        {angles.map((a, i) => {
          const [lx, ly] = pt(r + 28, a);
          let anchor = "middle";
          if (lx < cx - 6) anchor = "end"; else if (lx > cx + 6) anchor = "start";
          const v = areas[i].score;
          const c = v >= 65 ? "#34d399" : v >= 45 ? "#fbbf24" : "#fb7185";
          return (
            <g key={i}>
              <text x={lx} y={ly - 6} textAnchor={anchor} style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 12, fill: "#fff" }}>{areas[i].label}</text>
              <text x={lx} y={ly + 10} textAnchor={anchor} style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 500, fontSize: 11, fill: c }}>{Math.round(areas[i].score * t)}</text>
            </g>
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 38, fill: "#fff", letterSpacing: "-0.04em" }}>{Math.round(avg * t)}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 9, fill: "#9fbde7", letterSpacing: "0.22em", textTransform: "uppercase" }}>BOSS Score</text>
      </svg>
      <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 8, fontSize: 11, fontWeight: 600, color: "#9fbde7", letterSpacing: "0.06em" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 22, height: 3, background: "linear-gradient(90deg,#42a1ee,#0c5290)", borderRadius: 2 }}></span>Today
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 22, height: 0, borderTop: "2px dashed #10b981" }}></span>Target
        </span>
      </div>
    </div>
  );
}

// ====== Section 8 — Why it works (4 differentiators) ======
function WhyItWorks() {
  const items = [
    { num: "01", title: "Personalised attention", body: "A certified Profit Coach working one-to-one with you. They know your business, your numbers, your priorities. The plan is built for you." },
    { num: "02", title: "A proven system", body: "The Profit System covers every area of your business — from owner performance to team leadership. Built from 25+ leading business frameworks." },
    { num: "03", title: "Diagnosis, not guesswork", body: "Every engagement starts with the BOSS Diagnostic. You see exactly where you stand. Your coach works from your data, not their opinion." },
    { num: "04", title: "Measurable results", body: "Progress is tracked every 90 days. Before/after data shows exactly what moved. You always know where you stand." },
  ];
  return (
    <section id="why-it-works" className="pc-section" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 720, marginBottom: 56 }}>
          <span className="pc-eyebrow">Why It Works</span>
          <h2 style={{
            margin: "16px 0 0",
            fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300,
            letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a",
          }}>What makes a Profit Coach different.</h2>
        </div>
        <div className="pc-why-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20,
        }}>
          {items.map((it, i) => (
            <div key={it.num} className="pc-card reveal" style={{
              transitionDelay: `${i * 40}ms`, padding: 28,
              display: "flex", flexDirection: "column", gap: 14,
            }}>
              <div className="mono" style={{
                fontSize: 13, fontWeight: 600, color: "#0c5290",
                letterSpacing: "0.06em",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 18, height: 1, background: "#0c5290" }}></span>{it.num}
              </div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em", color: "#0f172a" }}>{it.title}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#475569" }}>{it.body}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .pc-why-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .pc-why-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

// ====== Section 9 — Elite framing ======
function EliteFraming() {
  return (
    <section className="pc-section--tight" style={{
      padding: "112px 0", background: "var(--bg-canvas)", textAlign: "center",
    }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{
            width: 64, height: 2, background: "linear-gradient(90deg,#0c5290,#1ca0c2)",
            margin: "0 auto 28px",
          }} />
          <span className="pc-eyebrow">The Operator's Edge</span>
          <h2 style={{
            margin: "16px 0 28px",
            fontSize: "clamp(32px, 3.6vw, 52px)", fontWeight: 300,
            letterSpacing: "-0.035em", lineHeight: 1.1, color: "#0f172a",
          }}>The world's best businesses run on a system.</h2>
          <p style={{ fontSize: 19, lineHeight: 1.7, color: "#475569", margin: "0 auto 18px", maxWidth: 680 }}>
            The owner-operators who win are the ones who installed an operating system early — and worked it
            consistently. The ones who plateau are the ones still running the business out of their own head.
          </p>
          <p style={{ fontSize: 19, lineHeight: 1.7, color: "#475569", margin: "0 auto 18px", maxWidth: 680 }}>
            A certified Profit Coach gives you the system, the accountability, and the outside perspective to
            see what you can't see from inside.
          </p>
          <p style={{
            fontSize: 19, lineHeight: 1.7, color: "#0f172a",
            margin: "0 auto", maxWidth: 680, fontWeight: 600,
          }}>
            You don't need more advice. You need a coach who knows what to install, in what order,
            and how to make it stick.
          </p>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { ProfitSystem, WhyItWorks, EliteFraming });
