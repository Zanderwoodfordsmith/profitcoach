/* global React, Icon, BossWheel */
const { useState: useStateBS, useEffect: useEffectBS } = React;

// ============================================================
// What you'll get — feature breakdown of the report
// ============================================================
function WhatsInside() {
  const items = [
    { n: "01", title: "Your BOSS Score", body: "A single 0–100 number that captures the operational health of your business. The same yardstick we use with every owner.", icon: "trending" },
    { n: "02", title: "Your Owner Level", body: "Where you sit on the 5-Level ladder — Overwhelmed, Overworked, Organised, Overseer, or Owner. With the next level's lift already mapped.", icon: "compass" },
    { n: "03", title: "The 10-Area Heatmap", body: "How you score across all 10 functional areas of your business. Wins are obvious. Leaks are obvious. So is the order to fix them.", icon: "target" },
    { n: "04", title: "Your Top 3 Priorities", body: "Three sequenced moves — picked from 50 BOSS playbooks — chosen for the highest ROI on the smallest effort, given your scores.", icon: "lightbulb" },
    { n: "05", title: "The Funnel Multiplier", body: "Your personal £ uplift if you improve each of the five revenue levers by just 10%. Maths, not vibes.", icon: "pound" },
    { n: "06", title: "A Conversation Worth Having", body: "Optional 20-min review with a Profit Coach to walk through your report. No pitch script. No upsell.", icon: "users" },
  ];
  return (
    <section id="whats-inside" className="pc-section" data-screen-label="BOSS / What's inside" style={{ background: "var(--bg-canvas)", scrollMarginTop: 24 }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 720, marginBottom: 56 }}>
          <span className="pc-eyebrow">What you get</span>
          <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(32px, 4.4vw, 52px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.06, color: "#0f172a" }}>
            A 1-page report worth more than most coaching engagements.
          </h2>
          <p style={{ fontSize: 22, lineHeight: 1.65, color: "#475569", margin: 0 }}>
            Not a generic PDF. A personalised, sequenced plan you can act on this week.
          </p>
        </div>
        <div className="bw-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {items.map((it, i) => (
            <div key={it.n} className="pc-card reveal" style={{ transitionDelay: `${i * 50}ms`, padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: "#0c5290", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 18, height: 1, background: "#0c5290" }}></span>{it.n}
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(12,82,144,0.08)", color: "#0c5290", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={it.icon} size={18} strokeWidth={2} />
                </div>
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em", color: "#0f172a" }}>{it.title}</h3>
              <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "#475569" }}>{it.body}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .bw-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .bw-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

// ============================================================
// How it works — 3 steps to the report
// ============================================================
function HowToReport() {
  const steps = [
    { n: "01", t: "Answer 50 questions", body: "Across 10 areas of business. Each scored 0/1/2. No long-form. No 'rate yourself out of 10' fluff.", time: "10 minutes" },
    { n: "02", t: "Get your BOSS Report", body: "Score, level, heatmap, priorities, and funnel-multiplier delivered to your inbox the moment you finish.", time: "Instantly" },
    { n: "03", t: "Decide your next move", body: "Act on it yourself, share it with your team, or book a 20-min review with a Profit Coach. Up to you.", time: "On your terms" },
  ];
  return (
    <section className="pc-section" data-screen-label="BOSS / How it works" style={{ background: "#fff" }}>
      <div className="pc-container">
        <div className="reveal" style={{ maxWidth: 720, marginBottom: 56 }}>
          <span className="pc-eyebrow">How it works</span>
          <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#0f172a" }}>
            Three steps. Then you have it.
          </h2>
        </div>
        <div className="bw-steps" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, position: "relative" }}>
          {/* connecting line */}
          <div className="bw-line" aria-hidden="true" style={{ position: "absolute", top: 36, left: "16.6%", right: "16.6%", height: 2, background: "linear-gradient(90deg, transparent, #cbd5e1 12%, #cbd5e1 88%, transparent)", zIndex: 0 }} />
          {steps.map((s, i) => (
            <div key={s.n} className="reveal" style={{ transitionDelay: `${i * 80}ms`, padding: "0 24px", textAlign: "center", position: "relative", zIndex: 1 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%", margin: "0 auto",
                background: "linear-gradient(135deg,#0c5290,#073157)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em",
                boxShadow: "0 16px 32px -8px rgba(12,82,144,0.45)",
                border: "4px solid #fff",
              }}>{s.n}</div>
              <h3 style={{ margin: "20px 0 10px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "#0f172a" }}>{s.t}</h3>
              <p style={{ margin: "0 auto", fontSize: 19, lineHeight: 1.6, color: "#475569", maxWidth: 280 }}>{s.body}</p>
              <div style={{ marginTop: 14, padding: "5px 10px", display: "inline-flex", fontSize: 11, fontWeight: 600, color: "#047857", letterSpacing: "0.06em", background: "rgba(16,185,129,0.10)", borderRadius: 9999 }}>{s.time}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 880px) {
          .bw-steps { grid-template-columns: 1fr !important; gap: 36px !important; }
          .bw-line { display: none !important; }
        }
      `}</style>
    </section>
  );
}

// ============================================================
// Sample question — credibility / show-don't-tell
// ============================================================
function SampleQuestion() {
  const [ans, setAns] = useStateBS(null);
  const opts = [
    { v: 0, label: "No formal documented process. Each rep does it their own way.", color: "#e11d48" },
    { v: 1, label: "There's a process — but it's mostly tribal knowledge, not written down.", color: "#f59e0b" },
    { v: 2, label: "Documented, taught, followed, and reviewed. Onboarding to it takes weeks not months.", color: "#10b981" },
  ];
  return (
    <section className="pc-section" data-screen-label="BOSS / Sample question" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container">
        <div className="bw-sample-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 64, alignItems: "center" }}>
          <div className="reveal">
            <span className="pc-eyebrow">A sample question</span>
            <h2 style={{ margin: "16px 0 16px", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.06, color: "#0f172a" }}>
              No fluff. <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#0c5290,#1ca0c2)", WebkitBackgroundClip: "text", color: "transparent" }}>Just signal.</em>
            </h2>
            <p style={{ fontSize: 21, lineHeight: 1.65, color: "#475569", margin: "0 0 20px" }}>
              Every question is scored 0, 1, or 2. The wording is deliberate — there's no room to "rate yourself a 7" because you feel optimistic this week.
            </p>
            <p style={{ fontSize: 21, lineHeight: 1.65, color: "#475569", margin: 0 }}>
              50 of these. Then your full picture, on one page.
            </p>
          </div>

          <div className="reveal pc-card" style={{ padding: 36 }}>
            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#0c5290", letterSpacing: "0.18em", marginBottom: 8 }}>QUESTION 14 / 50 · OPERATIONS &amp; DELIVERY</div>
            <h3 style={{ margin: "8px 0 22px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "#0f172a", lineHeight: 1.3 }}>
              How well-defined is your sales process?
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {opts.map((o) => {
                const active = ans === o.v;
                return (
                  <button key={o.v} onClick={() => setAns(o.v)} aria-pressed={active} style={{
                    display: "flex", alignItems: "flex-start", gap: 14, textAlign: "left",
                    padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                    background: active ? "#fff" : "#fafbfc",
                    border: active ? `1.5px solid ${o.color}` : "1.5px solid var(--pc-slate-200)",
                    boxShadow: active ? `0 12px 24px -10px ${o.color}55` : "none",
                    fontFamily: "var(--font-sans)",
                    transition: "all 200ms var(--ease-out)",
                  }}>
                    <span style={{
                      flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                      background: active ? o.color : `${o.color}18`,
                      color: active ? "#fff" : o.color,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em",
                    }}>{o.v}</span>
                    <span style={{ fontSize: 19, lineHeight: 1.5, color: "#1e293b", paddingTop: 6 }}>{o.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{
              marginTop: 22, padding: "14px 16px", borderRadius: 12,
              background: ans === null ? "#f1f5f9" : "rgba(16,185,129,0.08)",
              border: ans === null ? "1px solid #e2e8f0" : "1px solid rgba(16,185,129,0.30)",
              fontSize: 17, color: ans === null ? "#64748b" : "#047857", fontWeight: 500, lineHeight: 1.5,
            }}>
              {ans === null ? "Pick an answer to see what your real diagnostic feels like." : `Locked in. ${49} more like this and you've got your full BOSS picture.`}
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .bw-sample-grid { grid-template-columns: 1fr !important; gap: 40px !important; } }`}</style>
    </section>
  );
}

// ============================================================
// Mid-page CTA strip
// ============================================================
function MidCTA() {
  return (
    <section style={{
      padding: "64px 0",
      background: "linear-gradient(135deg,#0c5290 0%,#073157 60%,#061a2e 100%)",
      color: "#fff", position: "relative", overflow: "hidden",
    }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none", background: "radial-gradient(circle at 80% 20%, rgba(66,161,238,0.4), transparent 50%), radial-gradient(circle at 15% 80%, rgba(28,160,194,0.3), transparent 55%)" }} />
      <div className="pc-container" style={{ position: "relative" }}>
        <div className="bw-mid" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 300, letterSpacing: "-0.025em", lineHeight: 1.15, color: "#fff" }}>
              Ready to stop guessing?
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 19, color: "#cfdef3" }}>
              10 minutes. Free. No credit card. No call required.
            </p>
          </div>
          <a href="#start" className="boss-cta-primary" onClick={(e) => window.bossSmoothScrollTo("start", e)}>
            Start the BOSS Diagnostic <Icon name="arrowRight" size={16} strokeWidth={2.25} />
          </a>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Founder note — humanises the page
// ============================================================
function FounderNote() {
  return (
    <section className="pc-section" data-screen-label="BOSS / Founder note" style={{ background: "#fff" }}>
      <div className="pc-container" style={{ maxWidth: 880 }}>
        <div className="reveal" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "start" }} data-cls="bw-fn">
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "linear-gradient(135deg,#0c5290,#1ca0c2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 32, letterSpacing: "-0.02em",
            boxShadow: "0 16px 32px -10px rgba(12,82,144,0.45)",
          }}>SC</div>
          <div>
            <span className="pc-eyebrow">A note from the founder</span>
            <p style={{ margin: "12px 0 14px", fontSize: 26, lineHeight: 1.5, fontWeight: 300, letterSpacing: "-0.015em", color: "#0f172a" }}>
              "Most owners I meet are stuck not because they're working too little — but because they have no honest, scored picture of where their business actually is. The diagnostic exists to fix that. In ten minutes, before any conversation."
            </p>
            <div style={{ fontSize: 18, color: "#64748b" }}>
              <strong style={{ color: "#0f172a" }}>Steve Chan</strong> · Founder, The Profit Coach
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 720px) { [data-cls="bw-fn"] { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

// ============================================================
// FAQ
// ============================================================
function BossFAQs() {
  const [open, setOpen] = useStateBS(0);
  const items = [
    { q: "How long does it really take?", a: "Most people finish in 8–12 minutes. The questions are deliberate — short enough to keep moving, sharp enough to capture real signal. You can pause and resume." },
    { q: "What's the catch? Why is it free?", a: "There isn't one. The diagnostic is the front door to our work — owners who like their report come back when they're ready to do the work. Owners who don't, don't. We've made peace with that." },
    { q: "Will I be put on a call list?", a: "No. You'll get the report by email. There's an optional 20-min review with a coach if you want one — initiated by you, never auto-booked. Unsubscribe with one click." },
    { q: "What if my numbers are bad?", a: "Then the diagnostic will tell you that, clearly. That's the point. A bad score with a clear top-3 is infinitely more useful than a vague 'how was the year' conversation." },
    { q: "I'm not the owner — can I still take it?", a: "Yes, and the report is genuinely useful for COOs, GMs and integrators. But the 5-Level lens is calibrated to the owner role — so the most accurate picture comes from whoever sets direction and bears risk." },
    { q: "Can I retake it?", a: "Yes — and you should. We recommend re-taking every 90 days. The deltas on your wheel and grid are where the real story lives." },
  ];
  return (
    <section className="pc-section" data-screen-label="BOSS / FAQs" style={{ background: "var(--bg-canvas)" }}>
      <div className="pc-container" style={{ maxWidth: 880 }}>
        <div className="reveal" style={{ marginBottom: 40, textAlign: "center" }}>
          <span className="pc-eyebrow">Common questions</span>
          <h2 style={{ margin: "16px 0 0", fontSize: "clamp(28px, 3.4vw, 44px)", fontWeight: 300, letterSpacing: "-0.035em", lineHeight: 1.1, color: "#0f172a" }}>
            Before you start.
          </h2>
        </div>
        <div className="reveal" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{
                background: "#fff", borderRadius: 16,
                border: isOpen ? "1px solid rgba(12,82,144,0.30)" : "1px solid var(--pc-slate-200)",
                overflow: "hidden", transition: "border-color 200ms ease",
              }}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} style={{
                  width: "100%", padding: "20px 24px",
                  background: "transparent", border: "none", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  textAlign: "left", fontFamily: "var(--font-sans)",
                  fontSize: 17, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em",
                }}>
                  {it.q}
                  <span style={{ width: 32, height: 32, borderRadius: 9999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: isOpen ? "#0c5290" : "#f1f5f9", color: isOpen ? "#fff" : "#64748b", flexShrink: 0, transition: "all 200ms ease", transform: isOpen ? "rotate(45deg)" : "none" }}>
                    <Icon name="arrowRight" size={14} strokeWidth={2.5} />
                  </span>
                </button>
                <div style={{ maxHeight: isOpen ? 320 : 0, overflow: "hidden", transition: "max-height 280ms var(--ease-out)" }}>
                  <div style={{ padding: "0 24px 22px", fontSize: 19, lineHeight: 1.65, color: "#475569" }}>{it.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Final CTA + email capture (id=start)
// ============================================================
function FinalStartCTA() {
  const [step, setStep] = useStateBS(1);
  const [firstName, setFirstName] = useStateBS("");
  const [lastName, setLastName] = useStateBS("");
  const [email, setEmail] = useStateBS("");
  const [phoneCountryCode, setPhoneCountryCode] = useStateBS("+44");
  const [phone, setPhone] = useStateBS("");
  const [error, setError] = useStateBS("");
  const [submitting, setSubmitting] = useStateBS(false);

  const COUNTRY_CODES = [
    { code: "+44", label: "UK +44" },
    { code: "+353", label: "IE +353" },
    { code: "+1", label: "US/CA +1" },
    { code: "+61", label: "AU +61" },
    { code: "+64", label: "NZ +64" },
    { code: "+27", label: "ZA +27" },
  ];

  function getCoachSlug() {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get("coach") || "BCA").trim() || "BCA";
    } catch {
      return "BCA";
    }
  }

  function captureLead(payload) {
    return fetch("/api/leads/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function onStep1(e) {
    e.preventDefault();
    setError("");
    if (!firstName.trim()) return setError("Please enter your first name.");
    if (!lastName.trim()) return setError("Please enter your last name.");
    setStep(2);
  }

  function onStep2(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Please enter your email.");

    const coachSlug = getCoachSlug();
    const first = firstName.trim();
    const last = lastName.trim();
    captureLead({
      coachSlug,
      contact: {
        first_name: first || undefined,
        last_name: last || undefined,
        full_name: [first, last].filter(Boolean).join(" ") || undefined,
        email: email.trim(),
      },
    });
    setStep(3);
  }

  function onStep3(e) {
    e.preventDefault();
    setError("");
    if (!phone.trim()) return setError("Please enter your phone number.");

    const coachSlug = getCoachSlug();
    const first = firstName.trim();
    const last = lastName.trim();
    const fullName = [first, last].filter(Boolean).join(" ");
    const fullPhone = `${phoneCountryCode} ${phone.trim()}`.trim();

    setSubmitting(true);
    fetch("/api/landing/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: "a",
        coach_slug: coachSlug,
        event_type: "opt_in",
      }),
    }).catch(() => {});

    captureLead({
      coachSlug,
      contact: {
        first_name: first || undefined,
        last_name: last || undefined,
        full_name: fullName || undefined,
        email: email.trim(),
        phone: fullPhone || undefined,
      },
    });

    try {
      sessionStorage.setItem(
        "boss_landing_contact",
        JSON.stringify({
          firstName: first,
          lastName: last,
          fullName: fullName || undefined,
          email: email.trim(),
          phone: fullPhone,
        })
      );
    } catch {}

    window.location.href = `/assessment/${encodeURIComponent(coachSlug)}?from_landing=a`;
  }

  return (
    <section id="start" style={{
      padding: "120px 0",
      background: "linear-gradient(135deg,#0c5290 0%,#073157 55%,#061a2e 100%)",
      color: "#fff", position: "relative", overflow: "hidden",
      scrollMarginTop: 24,
    }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.55, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 88% 18%, rgba(66,161,238,0.55), transparent 55%), radial-gradient(ellipse 50% 50% at 8% 80%, rgba(28,160,194,0.4), transparent 55%)" }} />
      <div className="pc-container" style={{ position: "relative", textAlign: "center" }}>
        <div className="reveal" style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#fff" }}>
            Get your <em style={{ fontStyle: "normal", fontWeight: 700, background: "linear-gradient(135deg,#42a1ee,#34d399)", WebkitBackgroundClip: "text", color: "transparent" }}>BOSS Score</em> in 10 minutes.
          </h2>
          <p style={{ fontSize: 22, lineHeight: 1.6, color: "#cfdef3", margin: "0 auto 36px", maxWidth: 540 }}>
            Drop your email. We'll send the diagnostic link straight away. Your report lands in your inbox the moment you finish.
          </p>

          <form onSubmit={step === 1 ? onStep1 : step === 2 ? onStep2 : onStep3} style={{
            display: "flex", gap: 8, padding: 8,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(14px)",
            borderRadius: 9999, maxWidth: 620, margin: "0 auto 10px",
          }}>
            {step === 1 && (
              <>
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    color: "#fff", padding: "14px 18px", fontSize: 20,
                    fontFamily: "var(--font-sans)", outline: "none",
                  }}
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    color: "#fff", padding: "14px 18px", fontSize: 20,
                    fontFamily: "var(--font-sans)", outline: "none",
                  }}
                />
              </>
            )}
            {step === 2 && (
              <input
                type="email"
                placeholder="you@yourcompany.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  flex: 1, background: "transparent", border: "none",
                  color: "#fff", padding: "14px 18px", fontSize: 20,
                  fontFamily: "var(--font-sans)", outline: "none",
                }}
              />
            )}
            {step === 3 && (
              <>
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  style={{
                    background: "transparent", border: "none",
                    color: "#fff", padding: "14px 8px", fontSize: 20,
                    fontFamily: "var(--font-sans)", outline: "none",
                  }}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} style={{ color: "#0f172a" }}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    color: "#fff", padding: "14px 18px", fontSize: 20,
                    fontFamily: "var(--font-sans)", outline: "none",
                  }}
                />
              </>
            )}
            <button type="submit" className="boss-cta-primary" style={{ padding: "14px 24px" }}>
              {submitting ? "Starting..." : "Continue"} <Icon name="arrowRight" size={14} strokeWidth={2.5} />
            </button>
          </form>
          {error && (
            <div style={{ color: "#fecaca", fontSize: 17, marginBottom: 8 }}>
              {error}
            </div>
          )}
          {step > 1 && (
            <button
              type="button"
              onClick={() => { setError(""); setStep(step - 1); }}
              style={{
                background: "transparent",
                border: "none",
                color: "#9fbde7",
                cursor: "pointer",
                fontSize: 17,
                marginBottom: 10,
              }}
            >
              ← Previous
            </button>
          )}
          <div style={{ fontSize: 16, color: "#9fbde7", letterSpacing: "0.04em" }}>
            No credit card · No call list · Unsubscribe one click
          </div>

          <div style={{ marginTop: 56, display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
            {[
              ["10 min", "to complete"],
              ["1-page", "personalised report"],
              ["£0", "to start"],
            ].map((t, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{t[0]}</div>
                <div style={{ fontSize: 16, color: "#9fbde7", letterSpacing: "0.02em" }}>{t[1]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        input::placeholder { color: rgba(207,222,243,0.55); }
        input:focus { outline: none; }
      `}</style>
    </section>
  );
}

window.WhatsInside = WhatsInside;
window.HowToReport = HowToReport;
window.SampleQuestion = SampleQuestion;
window.MidCTA = MidCTA;
window.FounderNote = FounderNote;
window.BossFAQs = BossFAQs;
window.FinalStartCTA = FinalStartCTA;
