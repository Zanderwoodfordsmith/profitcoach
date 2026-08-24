"use client";

import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * The standard marketing navigation, shared across all public brand pages.
 *
 * - `overlay`: transparent over a gradient hero, turns solid on scroll (homepage).
 * - `solid`: always a solid sticky white bar (blog, directory, inner pages).
 */

const inter = Inter({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const CTA_GRADIENT = "linear-gradient(155deg, #0a6fa8 0%, #1aa3e0 100%)";

/** Flip to "/" when the new homepage is promoted to the root URL. */
export const LINK_HOME = "/home-v3";
const LINK_SCORE = "/score";
const LOGO_COLOUR = "/profit-coach-logo.svg";
const LOGO_WHITE = "/brand/profit-coach-logo-white.svg";

/** The standard menu. About joins this list once the page exists. */
const NAV_LINKS = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Coaches", href: "/directory" },
  { label: "Blog", href: "/blog" },
] as const;

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function MarketingNav({
  variant = "solid",
}: {
  variant?: "overlay" | "solid";
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (variant === "solid") return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  const solid = variant === "solid" || scrolled || mobileOpen;

  return (
    <header
      className={cx(
        inter.className,
        "inset-x-0 top-0 z-50 transition-all duration-300",
        variant === "overlay" ? "fixed" : "sticky",
        solid
          ? "border-b border-[#e3ecf4] bg-white/90 shadow-[0_8px_30px_-20px_rgba(5,30,54,0.35)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-4 md:px-8">
        <Link href={LINK_HOME} className="flex items-center" aria-label="The Profit Coach home">
          <Image
            src={solid ? LOGO_COLOUR : LOGO_WHITE}
            alt="The Profit Coach"
            width={168}
            height={40}
            className="h-9 w-auto"
            priority
            unoptimized
          />
        </Link>

        <nav
          className={cx(
            "hidden items-center gap-7 text-[14px] font-medium lg:flex",
            solid ? "text-[#46586a]" : "text-white/80"
          )}
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cx(
                "transition-colors",
                solid ? "hover:text-[#0c5290]" : "hover:text-white"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={LINK_SCORE}
            className={cx(
              "hidden rounded-full px-5 py-2.5 text-[13px] font-semibold transition sm:inline-flex",
              solid
                ? "text-white shadow-[0_10px_24px_-10px_rgba(26,163,224,0.7)] hover:brightness-110"
                : "bg-white text-[#0c5290] hover:bg-[#eaf5ff]"
            )}
            style={solid ? { background: CTA_GRADIENT } : undefined}
          >
            Get your BOSS Score
          </Link>
          <button
            type="button"
            className={cx(
              "inline-flex size-10 items-center justify-center rounded-full border lg:hidden",
              solid ? "border-[#c6d8e8] text-[#0b1c2c]" : "border-white/40 text-white"
            )}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[#e3ecf4] bg-white px-5 py-6 lg:hidden">
          <nav className="flex flex-col gap-4 text-[15px] font-medium text-[#0b1c2c]">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="py-1"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={LINK_SCORE}
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_34px_-14px_rgba(26,163,224,0.65)]"
              style={{ background: CTA_GRADIENT }}
            >
              Get your BOSS Score
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
