/* global React, Icon */
const { useState: useStateH, useEffect: useEffectH } = React;

function Header() {
  const [scrolled, setScrolled] = useStateH(false);
  const [mobileOpen, setMobileOpen] = useStateH(false);
  useEffectH(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: "How It Works", href: "How%20It%20Works.html" },
    { label: "Why The Profit Coach", href: "Why%20The%20Profit%20Coach.html" },
    { label: "Find a Coach", href: "#" },
    { label: "Resources", href: "#" },
  ];

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 60,
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      background: scrolled ? "rgba(245,248,252,0.85)" : "rgba(245,248,252,0.55)",
      borderBottom: scrolled ? "1px solid rgba(15,23,42,0.08)" : "1px solid transparent",
      transition: "background 200ms ease, border-color 200ms ease",
    }}>
      <div className="pc-container" style={{ display: "flex", alignItems: "center", gap: 32, padding: "16px 32px" }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="assets/icon-mark-color.svg" alt="" style={{ width: 30, height: 30 }} />
          <span style={{ fontWeight: 700, color: "#0c5290", fontSize: 17, letterSpacing: "-0.01em" }}>The Profit Coach</span>
        </a>
        <nav className="pc-nav-desktop" style={{ display: "flex", gap: 26, marginLeft: 16 }}>
          {links.map(l => (
            <a key={l.label} href={l.href} style={{
              fontSize: 14, fontWeight: 500, color: "#334155", textDecoration: "none",
              transition: "color 150ms ease",
            }} onMouseEnter={(e) => e.currentTarget.style.color = "#0c5290"}
               onMouseLeave={(e) => e.currentTarget.style.color = "#334155"}>{l.label}</a>
          ))}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <a href="#" className="pc-nav-desktop-cta" style={{
            fontSize: 14, fontWeight: 600, color: "#fff",
            background: "linear-gradient(135deg,#0c5290,#063056)",
            padding: "11px 20px", borderRadius: 9999,
            textDecoration: "none",
            boxShadow: "0 8px 24px -8px rgba(12,82,144,0.55)", whiteSpace: "nowrap",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>Take the BOSS Diagnostic <span style={{ fontSize: 16 }}>→</span></a>
          <button
            className="pc-nav-mobile-btn"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            style={{
              display: "none",
              background: "transparent", border: "1px solid rgba(15,23,42,0.12)",
              borderRadius: 9999, padding: 10, cursor: "pointer", color: "#0c5290",
            }}><Icon name="menu" size={20} /></button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(6,16,24,0.94)",
          backdropFilter: "blur(20px)", zIndex: 100, padding: 28,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>The Profit Coach</span>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 9999, padding: 10, cursor: "pointer", color: "#fff",
            }}><Icon name="close" size={20} /></button>
          </div>
          {links.map(l => (
            <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)} style={{
              color: "#fff", textDecoration: "none", fontSize: 28, fontWeight: 300,
              letterSpacing: "-0.02em", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>{l.label}</a>
          ))}
          <a href="#" onClick={() => setMobileOpen(false)} style={{
            marginTop: 32,
            background: "linear-gradient(135deg,#0c5290,#063056)", color: "#fff",
            fontWeight: 600, fontSize: 16, padding: "18px 24px", borderRadius: 9999,
            textDecoration: "none", textAlign: "center",
          }}>Take the BOSS Diagnostic →</a>
        </div>
      )}

      <style>{`
        @media (max-width: 880px) {
          .pc-nav-desktop { display: none !important; }
          .pc-nav-desktop-cta { display: none !important; }
          .pc-nav-mobile-btn { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}

window.Header = Header;
