/* global React, Icon, BossWheel */
const { useState: useStateC } = React;

// ====== Section 10 — Testimonials (with BOSS Wheel mini per card) ======
function Testimonials() {
  const items = [
    {
      quote: "We went from £600K to £1.2M in 18 months without me adding a single hour to my week. The team carries it now.",
      name: "Sarah Whitman",
      role: "MD, Whitman Joinery",
      delta: { from: 600, to: 1200, unit: "K", label: "Revenue" },
      stage: { from: "Operator", to: "Optimised" },
      score: { from: 38, to: 71 },
    },
    {
      quote: "The diagnostic showed me exactly where the leaks were. Six months in, gross margin is up 14 points. I haven't worked a Saturday since February.",
      name: "Daniel Okafor",
      role: "Founder, Okafor Logistics",
      delta: { from: 21, to: 35, unit: "%", label: "Gross Margin" },
      stage: { from: "Overwhelm", to: "Organised" },
      score: { from: 24, to: 62 },
    },
    {
      quote: "I've worked with three coaches before this. None of them had a system. None of them looked at my numbers. This was different from week one.",
      name: "Priya Shah",
      role: "MD, Shah Dental Group",
      delta: { from: 11, to: 23, unit: "%", label: "Operating Profit" },
      stage: { from: "Operator", to: "Optimised" },
      score: { from: 41, to: 78 },
    },
  ];
  const [active, setActive] = useStateC(0);
  return (
    <section className="pc-section" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 720, marginBottom: 48, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
          <div>
            <span className="pc-eyebrow">Owners Like You</span>
            <h2 style={{
              margin: "16px 0 0",
              fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300,
              letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a",
            }}>What changes — measured, not felt.</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {items.map((_, i) => (
              <button key={i} onClick={() => setActive(i)} aria-label={`Show testimonial ${i + 1}`} style={{
                width: i === active ? 28 : 8, height: 8, borderRadius: 9999,
                background: i === active ? "#0c5290" : "#cbd5e1",
                border: "none", cursor: "pointer", transition: "all 200ms ease",
                padding: 0,
              }} />
            ))}
          </div>
        </div>

        <div className="pc-test-grid reveal" style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20,
        }}>
          {items.map((it, i) => (
            <article key={i} className="pc-card" style={{
              padding: 28, display: "flex", flexDirection: "column", gap: 20,
              opacity: i === active ? 1 : 0.5,
              transform: i === active ? "scale(1.0)" : "scale(0.98)",
              borderColor: i === active ? "rgba(12,82,144,0.30)" : "var(--pc-slate-200)",
              boxShadow: i === active ? "0 24px 60px -20px rgba(12,82,144,0.25)" : "none",
              transition: "all 250ms var(--ease-out)",
            }}>
              {/* Mini BOSS wheel before/after */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, padding: 16, borderRadius: 16,
                background: "linear-gradient(135deg,#f5f8fc,#eaf2fb)",
                border: "1px solid #e2e8f0",
              }}>
                <MiniWheel score={it.score.from} tone="warn" />
                <div style={{ flex: 1, textAlign: "center" }}>
                  <Icon name="arrowRight" size={20} strokeWidth={2} style={{ color: "#0c5290", margin: "0 auto" }} />
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "#0c5290", marginTop: 6, letterSpacing: "-0.02em" }}>
                    +{it.score.to - it.score.from}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                    BOSS pts
                  </div>
                </div>
                <MiniWheel score={it.score.to} tone="ok" />
              </div>

              {/* The number that matters */}
              <div style={{
                display: "flex", alignItems: "baseline", gap: 14,
                paddingBottom: 16, borderBottom: "1px dashed #e2e8f0",
              }}>
                <div className="mono" style={{ fontSize: 14, color: "#94a3b8", textDecoration: "line-through" }}>
                  £{it.delta.from}{it.delta.unit}
                </div>
                <Icon name="arrowRight" size={14} strokeWidth={2} style={{ color: "#94a3b8" }} />
                <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: "#0c5290", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  £{it.delta.to}{it.delta.unit}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", marginLeft: "auto" }}>
                  {it.delta.label}
                </div>
              </div>

              <p style={{
                margin: 0, fontSize: 16, lineHeight: 1.6, color: "#1e293b",
                fontWeight: 400,
              }}>
                <span style={{ color: "#0c5290", fontSize: 28, fontWeight: 700, lineHeight: 0, position: "relative", top: 8, marginRight: 4 }}>“</span>
                {it.quote}
              </p>

              <div style={{ marginTop: "auto", display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 9999,
                  background: "linear-gradient(145deg,#42a1ee,#0c5290)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14, letterSpacing: "0.02em",
                }}>{it.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{it.role}</div>
                </div>
                <div style={{
                  marginLeft: "auto", padding: "4px 10px",
                  borderRadius: 9999, background: "rgba(16,185,129,0.10)",
                  color: "#047857", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                }}>{it.stage.from} → {it.stage.to}</div>
              </div>
            </article>
          ))}
        </div>

        <div className="reveal" style={{ marginTop: 36, textAlign: "center", fontSize: 13, color: "#64748b", fontStyle: "italic" }}>
          Names and figures shown are illustrative until full case studies are published.
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .pc-test-grid { grid-template-columns: 1fr !important; } .pc-test-grid article { opacity: 1 !important; transform: none !important; } }
      `}</style>
    </section>
  );
}

function MiniWheel({ score, tone }) {
  const size = 72, cx = size / 2, cy = size / 2, r = 26;
  const N = 10;
  const angles = Array.from({ length: N }, (_, i) => (-Math.PI / 2) + (i * 2 * Math.PI / N));
  // Vary scores around target — deterministic
  const noise = [0.85, 0.95, 1.05, 0.92, 1.08, 0.88, 1.02, 0.95, 1.0, 0.9];
  const pts = angles.map((a, i) => {
    const v = Math.min(100, Math.max(0, score * noise[i])) / 100;
    return [cx + r * v * Math.cos(a), cy + r * v * Math.sin(a)];
  });
  const stroke = tone === "ok" ? "#10b981" : tone === "warn" ? "#f59e0b" : "#0c5290";
  const fill = tone === "ok" ? "rgba(16,185,129,0.25)" : tone === "warn" ? "rgba(245,158,11,0.20)" : "rgba(12,82,144,0.18)";
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.7)" stroke="rgba(15,23,42,0.08)" />
        {angles.map((a, i) => {
          const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(15,23,42,0.06)" />;
        })}
        <path d={path} fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: stroke, marginTop: 2, letterSpacing: "-0.01em" }}>{score}</div>
    </div>
  );
}

// ====== Section 11 — FAQs ======
function FAQs() {
  const faqs = [
    { q: "I've worked with a business coach before. How is this different?", a: "Most business coaching is built around the coach's preferred frameworks and personal opinion. Profit Coaching is built around The Profit System — a complete operating methodology that covers every area of your business, with a diagnostic that shows your specific gaps. The plan comes from your data, not your coach's instinct." },
    { q: "How much does it cost?", a: "Coaching engagements vary by coach, scope, and length. Most clients invest between £1,500 and £3,000 per month for one-to-one Profit Coaching. The diagnostic is free. Speak to a coach to find out what fits your situation." },
    { q: "What if I don't have time for this right now?", a: "The owners who say this are usually the ones who need it most. The diagnostic takes 10 minutes. If you're in a busy season, your coach builds the plan around your timeline — not the other way around." },
    { q: "My business is small. Is this for me?", a: "If you're doing £200K or more in revenue and you have at least one person on your team, yes. The Profit System works for businesses up to £5M. Below £200K the priority is usually getting to a stable revenue base, which most Profit Coaches can also help with." },
    { q: "How long is a coaching engagement?", a: "Most engagements run for at least 6 months — long enough to take a complete diagnostic, build a 90-day plan, work the priorities, and re-take the diagnostic to measure what moved. Many clients renew for another 6 or 12 months." },
    { q: "What does a typical session look like?", a: "Sessions are structured around your diagnostic results and 90-day priorities. Your coach works from your data — your score, your numbers, your team — to walk through what's working, what's not, and what to do next. No fluff. No filler." },
    { q: "Can I just take the diagnostic without coaching?", a: "Yes. The BOSS Diagnostic is free and takes 10 minutes. You'll see your full score across all 10 areas of your business and a calculation of the revenue gap your current score represents. You don't have to speak to a coach. But most owners do — because seeing the gap is the easy part. Closing it is what takes a coach." },
    { q: "How do I find the right coach?", a: "Every coach in the directory is certified in the full Profit System. They differ in industry experience, location, and personal style. Browse the directory, read their profiles, and book an introductory call with one or two. The first call is free." },
  ];
  const [open, setOpen] = useStateC(0);
  return (
    <section className="pc-section" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="reveal" style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 40px" }}>
          <span className="pc-eyebrow">Common Questions</span>
          <h2 style={{
            margin: "16px 0 0",
            fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300,
            letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a",
          }}>The things owners ask first.</h2>
        </div>
        <div className="reveal" style={{ maxWidth: 820, margin: "0 auto" }}>
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{
                borderBottom: "1px solid #e2e8f0",
                borderLeft: isOpen ? "3px solid #0c5290" : "3px solid transparent",
                background: isOpen ? "#fff" : "transparent",
                borderRadius: isOpen ? 12 : 0,
                marginBottom: isOpen ? 8 : 0,
                boxShadow: isOpen ? "0 12px 32px -16px rgba(15,23,42,0.10)" : "none",
                transition: "all 200ms var(--ease-out)",
              }}>
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%", textAlign: "left", padding: "22px 24px",
                    background: "transparent", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                    fontFamily: "var(--font-sans)",
                  }}>
                  <span style={{
                    fontSize: 17, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em",
                    lineHeight: 1.4,
                  }}>{f.q}</span>
                  <span style={{
                    flexShrink: 0, transition: "transform 200ms ease",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    color: isOpen ? "#0c5290" : "#94a3b8",
                  }}><Icon name="chevronDown" size={20} /></span>
                </button>
                <div style={{
                  maxHeight: isOpen ? 400 : 0,
                  overflow: "hidden",
                  transition: "max-height 280ms var(--ease-out)",
                }}>
                  <p style={{
                    margin: 0, padding: "0 24px 24px",
                    fontSize: 15, lineHeight: 1.65, color: "#475569",
                  }}>{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ====== Section 12 — Closing ======
function Closing() {
  return (
    <section style={{
      position: "relative", overflow: "hidden",
      padding: "140px 0",
      background: `
        radial-gradient(ellipse 80% 60% at 50% 0%, rgba(66,161,238,0.18), transparent 60%),
        radial-gradient(ellipse 60% 50% at 50% 100%, rgba(28,160,194,0.14), transparent 55%),
        #fff`,
      borderTop: "1px solid #eaf0f7",
    }}>
      {/* Subtle BOSS-grid backdrop */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, opacity: 0.6, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(12,82,144,0.04) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(12,82,144,0.04) 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
        maskImage: "radial-gradient(ellipse 60% 70% at 50% 50%, #000 30%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 50% 50%, #000 30%, transparent 80%)",
      }} />
      <div className="pc-container" style={{ position: "relative", textAlign: "center" }}>
        <div className="reveal">
          <span className="pc-eyebrow">The Decision</span>
          <h2 style={{
            margin: "16px auto 28px",
            fontSize: "clamp(38px, 5vw, 64px)", fontWeight: 300,
            letterSpacing: "-0.04em", lineHeight: 1.05, color: "#0f172a",
            maxWidth: 18 + "ch",
          }}>
            Own your business.<br />
            <em style={{
              fontStyle: "normal", fontWeight: 700,
              background: "linear-gradient(135deg,#0c5290,#1ca0c2)",
              WebkitBackgroundClip: "text", color: "transparent",
            }}>Don't let it own you.</em>
          </h2>
          <p style={{
            fontSize: 19, lineHeight: 1.65, color: "#475569",
            margin: "0 auto 16px", maxWidth: 620,
          }}>
            You started this for a reason. The freedom, the income, the impact, the life you wanted to build.
          </p>
          <p style={{
            fontSize: 19, lineHeight: 1.65, color: "#0f172a",
            margin: "0 auto 40px", maxWidth: 620, fontWeight: 600,
          }}>
            The BOSS Diagnostic and a certified Profit Coach are how you get there.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            <a href="#start" className="pc-btn pc-btn--primary" onClick={(e) => window.bossSmoothScrollTo("start", e)}>
              Take the BOSS Diagnostic <Icon name="arrowRight" size={16} strokeWidth={2.25} />
            </a>
            <a href="#" className="pc-btn pc-btn--secondary">Speak to a Coach</a>
          </div>
          <p style={{ margin: 0, fontSize: 15, color: "#64748b", fontStyle: "italic" }}>
            Get the guidance you need to grow.
          </p>
        </div>
      </div>
    </section>
  );
}

// ====== Footer ======
function Footer() {
  const cols = [
    { h: "Explore", items: [
      ["The Profit System", "How%20It%20Works.html"],
      ["How It Works", "How%20It%20Works.html"],
      ["Why The Profit Coach", "Why%20The%20Profit%20Coach.html"],
      ["Find a Coach", "#"],
      ["Resources", "#"],
      ["Contact", "#"],
    ]},
    { h: "Legal", items: [["Privacy Policy", "#"], ["Terms of Use", "#"], ["Cookie Policy", "#"]] },
  ];
  return (
    <footer style={{ background: "#061a2e", color: "#cfdef3", padding: "64px 0 32px" }}>
      <div className="pc-container">
        <div className="pc-footer-grid" style={{
          display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.2fr", gap: 40, alignItems: "start",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="assets/icon-mark-white.svg" alt="" style={{ width: 30, height: 30 }} />
              <span style={{ fontWeight: 700, fontSize: 17, color: "#fff", letterSpacing: "-0.01em" }}>The Profit Coach</span>
            </div>
            <p style={{ marginTop: 14, fontSize: 18, lineHeight: 1.6, maxWidth: 380, color: "#9fbde7", fontStyle: "italic" }}>
              Less Chaos. More Profit. Real Freedom.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.h}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.24em", color: "#42a1ee", textTransform: "uppercase", marginBottom: 18 }}>{col.h}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {col.items.map(([label, href]) => <a key={label} href={href} style={{ fontSize: 18, color: "#cfdef3", textDecoration: "none" }}>{label}</a>)}
              </div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.24em", color: "#42a1ee", textTransform: "uppercase", marginBottom: 18 }}>
              Take the next step
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="#start" onClick={(e) => window.bossSmoothScrollTo("start", e)} style={{
                background: "#10b981", color: "#fff",
                padding: "12px 18px", borderRadius: 9999,
                textDecoration: "none", fontSize: 18, fontWeight: 600,
                textAlign: "center",
                boxShadow: "0 12px 24px -10px rgba(16,185,129,0.5)",
              }}>Take the BOSS Diagnostic →</a>
              <a href="#" style={{
                background: "transparent", color: "#fff",
                padding: "12px 18px", borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.18)",
                textDecoration: "none", fontSize: 18, fontWeight: 600,
                textAlign: "center",
              }}>Speak to a Coach</a>
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 56, paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          fontSize: 16, color: "#6b8aae",
        }}>
          <span>© 2026 The Profit Coach. All rights reserved.</span>
          <a href="#" style={{ color: "#6b8aae", textDecoration: "none" }}>Become a Certified Profit Coach</a>
        </div>
      </div>
      <style>{`
        @media (max-width: 880px) {
          .pc-footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          .pc-footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}

Object.assign(window, { Testimonials, FAQs, Closing, Footer });
