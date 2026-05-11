/* global React, Icon */

// ====== Section 4 — Key Benefits (6 cards) ======
function KeyBenefits() {
  const items = [
    { icon: "bargraph", title: "Increase your profit", body: "Find hidden margin. Take control of your numbers. Make every decision from data, not gut feel." },
    { icon: "trending", title: "Build predictable revenue", body: "Get a marketing and sales engine that delivers consistent leads — without you doing all the selling." },
    { icon: "team", title: "Lead a team that owns it", body: "Develop the leaders, systems, and culture so your team carries the weight you've been carrying alone." },
    { icon: "cog", title: "Systemise the work", body: "Document how the work gets done so quality and consistency don't depend on you being there." },
    { icon: "hourglass", title: "Reclaim your time", body: "Get out of the day-to-day. Lead from above the chaos. Stop being the bottleneck." },
    { icon: "map", title: "Get a clear plan", body: "Know exactly where the business is going, what to fix next, and what to leave for later." },
  ];
  return (
    <section className="pc-section" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 760, marginBottom: 56 }}>
          <span className="pc-eyebrow">What you get</span>
          <h2 style={{
            margin: "16px 0 0",
            fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300,
            letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a",
          }}>What you get with a certified Profit Coach.</h2>
        </div>

        <div className="pc-bnf-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20,
        }}>
          {items.map((it, i) => (
            <div key={it.title} className="pc-card reveal" style={{
              transitionDelay: `${i * 40}ms`,
              display: "flex", flexDirection: "column", gap: 18,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "linear-gradient(145deg,#42a1ee,#0c5290)",
                color: "#fff",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 12px 24px -8px rgba(12,82,144,0.4)",
              }}><Icon name={it.icon} size={22} strokeWidth={1.75} /></div>
              <h3 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-0.015em", color: "#0f172a" }}>{it.title}</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#475569" }}>{it.body}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 880px) { .pc-bnf-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .pc-bnf-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

// ====== Section 5 — Vision ======
function Vision() {
  return (
    <section className="pc-section" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="pc-vision-grid" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start",
        }}>
          <div className="reveal">
            <span className="pc-eyebrow">The Reality</span>
            <h2 style={{
              margin: "16px 0 0",
              fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 300,
              letterSpacing: "-0.035em", lineHeight: 1.06, color: "#0f172a",
            }}>
              Go from <span style={{ color: "#94a3b8" }}>grinding</span><br />
              to <em style={{
                fontStyle: "normal", fontWeight: 700,
                background: "linear-gradient(135deg,#0c5290,#1ca0c2)",
                WebkitBackgroundClip: "text", color: "transparent",
              }}>growing.</em>
            </h2>

            {/* Visual: 5-stage progression bar — echoes BOSS levels */}
            <div style={{ marginTop: 40 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.20em", color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>
                The Owner Journey · 5 Stages
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                {[
                  { l: "Overwhelm", c: "#e11d48", active: false },
                  { l: "Operator", c: "#f59e0b", active: true },
                  { l: "Organised", c: "#1ca0c2", active: false },
                  { l: "Optimised", c: "#0c5290", active: false },
                  { l: "Owner", c: "#10b981", active: false },
                ].map((s, i) => (
                  <div key={s.l}>
                    <div style={{
                      height: s.active ? 10 : 6, borderRadius: 9999,
                      background: s.active ? s.c : `${s.c}33`,
                      transition: "all 200ms ease",
                    }} />
                    <div style={{
                      fontSize: 11, fontWeight: s.active ? 700 : 500,
                      color: s.active ? s.c : "#94a3b8",
                      marginTop: 8, letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>0{i + 1}<br />{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
                Most owners we meet sit at Stage 02 — Operator.
              </div>
            </div>
          </div>

          <div className="reveal" style={{ paddingTop: 40 }}>
            <p style={{ fontSize: 18, lineHeight: 1.65, color: "#334155", margin: 0 }}>
              You started this for a reason. The income, the freedom, the impact, the life you wanted to build.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#475569", marginTop: 20 }}>
              Somewhere along the way, the business turned into a job — one that runs you instead of working for you.
              You can't take a real holiday. Decisions still come back to your desk. The team needs you for everything.
              Some months are great. Others, you're watching cash flow more carefully than you'd like.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#475569", marginTop: 20 }}>
              A certified Profit Coach gives you the structure to step back from the day-to-day, build a team
              that owns the work, and run a business that pays you back — in profit, in freedom, and in the life
              you started this for.
            </p>
            <p style={{
              fontSize: 17, lineHeight: 1.7, color: "#0f172a",
              marginTop: 24, paddingTop: 24, borderTop: "1px solid #e2e8f0",
              fontWeight: 600,
            }}>
              This is your roadmap to a business that works for you. Not because of you.
            </p>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .pc-vision-grid { grid-template-columns: 1fr !important; gap: 40px !important; } }
      `}</style>
    </section>
  );
}

// ====== Section 6 — Who it's for ======
function WhoItsFor() {
  const items = [
    "You can't take a real holiday without your phone",
    "You've delegated, but the important decisions still come back to you",
    "Revenue is unpredictable — good months and bad months with no clear pattern",
    "You're working harder than ever, but the business isn't growing proportionally",
    "You've read the books, tried a coach, attended the events. Things shifted for a few weeks. Then you were back where you were",
    "You can't see exactly where the business is leaking time, money, or both",
  ];
  return (
    <section className="pc-section" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="reveal" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <span className="pc-eyebrow">Who It's For</span>
          <h2 style={{
            margin: "16px 0 16px",
            fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300,
            letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a",
          }}>Built for owners who want more.</h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#475569", margin: 0 }}>
            For founders, owner-operators, and managing directors of businesses doing
            <strong style={{ color: "#0f172a", fontWeight: 600 }}> £200K to £5M</strong> — anyone who's built
            something real and is ready to make it work for them, not the other way around.
          </p>
        </div>

        <div className="reveal" style={{
          maxWidth: 820, margin: "48px auto 0",
          background: "#fff", borderRadius: 24,
          border: "1px solid var(--pc-slate-200)",
          padding: "8px",
          boxShadow: "0 12px 40px -16px rgba(15,23,42,0.08)",
        }}>
          <div style={{
            padding: "18px 24px", fontSize: 13, fontWeight: 600,
            color: "#0c5290", letterSpacing: "0.02em",
            display: "flex", alignItems: "center", gap: 10,
            borderBottom: "1px solid #f1f5f9",
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: 9999,
              background: "rgba(12,82,144,0.10)", color: "#0c5290",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
            }}>3+</span>
            If three or more of these sound like your week, a Profit Coach can help.
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: "8px 0" }}>
            {items.map((t, i) => (
              <li key={i} style={{
                display: "flex", gap: 14, alignItems: "flex-start",
                padding: "16px 24px",
                borderBottom: i < items.length - 1 ? "1px solid #f1f5f9" : "none",
              }}>
                <span style={{
                  marginTop: 2, flexShrink: 0,
                  width: 22, height: 22, borderRadius: 9999,
                  background: "rgba(16,185,129,0.12)", color: "#047857",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}><Icon name="check" size={14} strokeWidth={2.5} /></span>
                <span style={{ fontSize: 16, lineHeight: 1.55, color: "#334155" }}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { KeyBenefits, Vision, WhoItsFor });
