import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { LINK_HOME } from "./MarketingNav";

/** The standard marketing footer, shared across all public brand pages. */

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const CTA_GRADIENT = "linear-gradient(155deg, #0a6fa8 0%, #1aa3e0 100%)";
const LINK_SCORE = "/score";
const LINK_COACHES = "/directory";
const LOGO_WHITE = "/brand/profit-coach-logo-white.svg";

const EXPLORE_LINKS = [
  { label: "The 5 Levels", href: `${LINK_HOME}#levels` },
  { label: "The Profit System", href: `${LINK_HOME}#profit-system` },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Find a Coach", href: LINK_COACHES },
  { label: "Blog", href: "/blog" },
] as const;

export function MarketingFooter() {
  return (
    <footer className={`${inter.className} bg-[#051e36] py-16 text-white antialiased`}>
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image
              src={LOGO_WHITE}
              alt="The Profit Coach"
              width={150}
              height={36}
              className="h-8 w-auto"
              unoptimized
            />
            <p className="mt-4 max-w-[26ch] text-[13.5px] leading-relaxed text-white/55">
              Less chaos. More profit. Real freedom.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Explore
            </p>
            <ul className="mt-4 space-y-2.5 text-[14px] text-white/75">
              {EXPLORE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Legal
            </p>
            <ul className="mt-4 space-y-2.5 text-[14px] text-white/75">
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Terms of Use
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@theprofitcoach.com"
                  className="transition-colors hover:text-white"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Take the next step
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                href={LINK_SCORE}
                className="rounded-full px-5 py-2.5 text-center text-[13px] font-semibold text-white transition hover:brightness-110"
                style={{ background: CTA_GRADIENT }}
              >
                Get your BOSS Score
              </Link>
              <Link
                href={LINK_COACHES}
                className="rounded-full border border-white/25 px-5 py-2.5 text-center text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                Find a Coach
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-9 text-[12.5px] text-white/55 md:flex-row md:items-center md:justify-between">
          <p>© 2026 The Profit Coach. All rights reserved.</p>
          <Link href="/signup" className="transition-colors hover:text-white/80">
            Become a Certified Profit Coach
          </Link>
        </div>
      </div>
    </footer>
  );
}
