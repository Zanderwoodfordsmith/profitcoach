/* global React, Icon */

// Why The Profit Coach — differentiator sections

function WhyHero() {
  return (
    <section style={{
      position: "relative", overflow: "hidden",
      background: `radial-gradient(ellipse 70% 60% at 18% 12%, rgba(66,161,238,0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 92% 28%, rgba(13,148,136,0.13), transparent 55%), #f5f8fc`,
      paddingTop: 80, paddingBottom: 96,
    }}>
      <div className="pc-container" style={{ position: "relative", textAlign: "center" }}>
        <div className="reveal" style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", gap: 10, alignItems: "center", padding: "6px 16px 6px 6px", borderRadius: 9999, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(12,82,144,0.10)", backdropFilter: "blur(8px)", fontSize: 12, fontWeight: 600, color: "#0c5290", letterSpacing: "0.05em" }}>
            <span style={{ background: "#0c5290", color: "#fff", padding: "3px 10px", borderRadius: 9999, fontSize: 10, letterSpacing: "0.2em" }}>WHY US</span>
            What makes a Profit Coach different
          </div>
          <h1 style={{ margin: "26px auto 22px", fontSize: "clamp(40px, 5.4vw, 76px)", lineHeight: 1.02, fontWeight: 300, letterSpacing: "-0.035em", color: "#0f172a", maxWidth: "18ch" }}>
            Most coaching is opinion.<br />
            <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#0c5290,#1ca0c2)", WebkitBackgroundClip: "text", color: "transparent" }}>This is a system.</em>
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: "#475569", maxWidth: 680, margin: "0 auto 36px" }}>
            Six things separate a certified Profit Coach from the business coaching you've tried before. Each one matters. Together they're the reason it actually works.
          </p>
        </div>
      </div>
    </section>
  );
}

// "Most do X. We do Y." — the rhetorical positioning piece
function MostVsWe() {
  const rows = [
    { most: "Run on the coach's preferred frameworks and personal opinion.", we: "Run on the Profit System — a complete operating methodology that covers every area of your business." },
    { most: "Diagnose by conversation. Whatever's loudest gets the focus.", we: "Diagnose with 50 scored questions across 10 areas. The data shows the gaps." },
    { most: "Skip the owner. Treat the business as a thing separate from the person running it.", we: "Start with Owner Performance. Most frameworks don't have one. We made it the foundation." },
    { most: "Sell hours. Open-ended monthly calls.", we: "Install systems. Sequenced 90-day plans tied to playbooks tied to outcomes." },
    { most: "Measure progress with feel. 'How was this month?'", we: "Re-score every 90 days. Before/after deltas on the wheel and the grid. Nothing to interpret." },
    { most: "Are interchangeable. Switch coaches, switch methods.", we: "Every certified Profit Coach uses the same system. Your plan transfers. Your score transfers." },
  ];
  return (
    <section className="pc-section" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 760, marginBottom: 48 }}>
          <span className="pc-eyebrow">Most coaching vs. Profit Coaching</span>
          <h2 style={{ margin: "16px 0 0", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
            Six lines of difference.
          </h2>
        </div>
        <div className="reveal" style={{ background: "#fff", borderRadius: 24, border: "1px solid var(--pc-slate-200)", overflow: "hidden", boxShadow: "0 16px 60px -24px rgba(15,23,42,0.10)" }}>
          <div className="pc-most-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#f5f8fc", borderBottom: "1px solid var(--pc-slate-200)" }}>
            <div style={{ padding: "16px 24px", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.20em", textTransform: "uppercase" }}>Most coaching</div>
            <div style={{ padding: "16px 24px", fontSize: 11, fontWeight: 700, color: "#0c5290", letterSpacing: "0.20em", textTransform: "uppercase", borderLeft: "1px solid var(--pc-slate-200)" }}>Profit Coaching</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="pc-most-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: i < rows.length - 1 ? "1px solid var(--pc-slate-200)" : "none" }}>
              <div style={{ padding: "22px 24px", fontSize: 15, lineHeight: 1.55, color: "#64748b" }}>{r.most}</div>
              <div style={{ padding: "22px 24px", fontSize: 15, lineHeight: 1.55, color: "#0f172a", fontWeight: 500, borderLeft: "1px solid var(--pc-slate-200)", background: "linear-gradient(135deg, rgba(66,161,238,0.04), transparent)" }}>{r.we}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 720px) { .pc-most-row { grid-template-columns: 1fr !important; } .pc-most-row > div { border-left: none !important; } }`}</style>
    </section>
  );
}

// Six differentiators
function SixReasons() {
  const items = [
    { n: "01", title: "A real operating system, not advice", body: "The Profit System is a complete operating methodology — 10 areas, 5 levels, 50 playbooks. It maps the work of 25+ leading business thinkers (Hormozi, Gerber, Michalowicz, Harnish and more) into one connected system. It's what business coaching looks like when it grows up." },
    { n: "02", title: "Owner Performance as the foundation", body: "Almost every other framework treats the business as separate from the person running it. We don't. Owner Performance is the foundation of the BOSS grid — because the operator is the operating system, and most of what's stuck about the business is stuck because of how the owner is wired into it." },
    { n: "03", title: "A diagnostic, not a discovery call", body: "50 scored questions. 10 areas. A BOSS Score, a Level, a wheel, and a grid. The plan comes from your data, not from a conversation. No personality test. No 'where do you want to be in five years?' — that comes after we know where you are." },
    { n: "04", title: "Connected intelligence", body: "Your diagnostic feeds your plan. Your plan feeds your scoreboard. Your scoreboard feeds your coach. Your coach feeds the next quarter's plan. Every layer talks to every other layer — and to your real numbers. A coach with a notebook can't replicate this. Neither can ChatGPT." },
    { n: "05", title: "Maths, not vibes", body: "The Funnel Multiplier shows the £ uplift from a 10% improvement on each of five revenue levers. Time recapture quantifies the £10/£100/£1,000 work mix. Margin insight shows what one expense cut does to profit. The value of the engagement is mathematical — that's the point." },
    { n: "06", title: "One coach, every certified", body: "You get a single coach who knows your numbers and your people. Every certified Profit Coach is trained in the full system — so the system is the constant, the coach is the relationship. If you ever change coaches, your plan and your score come with you." },
  ];
  return (
    <section className="pc-section" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 720, marginBottom: 48 }}>
          <span className="pc-eyebrow">Six Reasons</span>
          <h2 style={{ margin: "16px 0 0", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
            Why this works when other coaching hasn't.
          </h2>
        </div>
        <div className="pc-six-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {items.map((it, i) => (
            <div key={it.n} className="pc-card reveal" style={{ transitionDelay: `${i * 40}ms`, padding: 32, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "#0c5290", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 18, height: 1, background: "#0c5290" }}></span>{it.n}
              </div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "#0f172a" }}>{it.title}</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#475569" }}>{it.body}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 880px) { .pc-six-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

// The Moat — connected intelligence
function TheMoat() {
  const layers = [
    { n: "01", t: "BOSS Diagnostic", b: "50 questions × 10 areas. Your score, your gaps, your level." },
    { n: "02", t: "90-Day Plan", b: "Top three priorities. Auto-suggested from your diagnostic. Tuned by your coach." },
    { n: "03", t: "BOSS Playbooks", b: "Single-page each. Problem → framework → action steps → template → expected result." },
    { n: "04", t: "BOSS Scoreboard", b: "Weekly cockpit. Team fills in. Owner reads. The numbers that matter, every week." },
    { n: "05", t: "AI Coach", b: "Fed your diagnostic, your plan, your scoreboard. Context no generic AI has." },
  ];
  return (
    <section className="pc-section" style={{ background: "linear-gradient(135deg,#0c5290 0%,#073157 60%,#061a2e 100%)", color: "#fff", position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none", background: "radial-gradient(circle at 80% 20%, rgba(66,161,238,0.4), transparent 50%), radial-gradient(circle at 15% 80%, rgba(28,160,194,0.3), transparent 55%)" }} />
      <div className="pc-container" style={{ position: "relative" }}>
        <div className="reveal" style={{ maxWidth: 760, marginBottom: 48 }}>
          <span className="pc-eyebrow eyebrow-on-dark" style={{ color: "#9fbde7" }}>The Moat</span>
          <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#fff" }}>
            Every layer talks to every other layer.
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "#cfdef3", margin: 0 }}>
            Any one of these could be replicated in a Notion doc. The connected intelligence is what makes it actually work — and what no competitor can replicate.
          </p>
        </div>
        <div className="pc-moat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, alignItems: "stretch" }}>
          {layers.map((l, i) => (
            <div key={l.n} className="reveal" style={{
              transitionDelay: `${i * 60}ms`,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(14px)",
              borderRadius: 20, padding: 22,
              display: "flex", flexDirection: "column", gap: 10,
              position: "relative",
            }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: "#9fbde7", letterSpacing: "0.16em" }}>{l.n}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{l.t}</div>
              <div style={{ fontSize: 13, color: "#cfdef3", lineHeight: 1.5 }}>{l.b}</div>
            </div>
          ))}
        </div>
        <div className="reveal" style={{ marginTop: 32, padding: "20px 24px", borderRadius: 16, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(52,211,153,0.30)", color: "#cfdef3", fontSize: 15, lineHeight: 1.6, textAlign: "center" }}>
            <strong style={{ color: "#fff" }}>92–95% coverage</strong> of what the global business-coaching market teaches — plus an Owner Performance foundation no other framework has, plus connected intelligence between every layer. That's the moat.
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .pc-moat-grid { grid-template-columns: 1fr 1fr !important; } } @media (max-width: 560px) { .pc-moat-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

window.WhyHero = WhyHero;
window.MostVsWe = MostVsWe;
window.SixReasons = SixReasons;
window.TheMoat = TheMoat;
