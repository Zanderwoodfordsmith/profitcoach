import Link from "next/link";

/** Matches the nav on the static site (scrollcraft/builds/profit-coach-site-v4). */
const LINKS = [
  { href: "/profit-system", label: "The Profit System" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/our-story", label: "Our story" },
  { href: "/directory", label: "Find your coach" },
];

export function SiteNav({ current }: { current?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E3E8EF] bg-[#F6F8FB]/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-[82rem] items-center gap-8 px-5 sm:px-[clamp(1.25rem,5vw,5.5rem)]">
        <Link href="/" aria-label="The Profit Coach, home" className="flex">
          <img src="/brand/profit-coach-logo-site.svg" alt="" width={178} height={27} className="h-[1.7rem] w-auto" />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 justify-end gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current === l.href ? "page" : undefined}
              className="rounded-full px-3.5 py-2 text-[0.9375rem] font-semibold text-[#46566B] hover:bg-[#0C5290]/5 hover:text-[#0D1F31] aria-[current=page]:text-[#0C5290]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/score"
          className="ml-auto hidden h-[2.6rem] items-center rounded-full bg-[#0C5290] px-4 text-[0.9375rem] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(12,82,144,0.6)] hover:bg-[#0A467B] sm:inline-flex lg:ml-0"
        >
          Get my score
        </Link>
        <details className="relative ml-auto sm:ml-0 lg:hidden">
          <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg bg-[#0C5290]/10 text-[#0D1F31] [&::-webkit-details-marker]:hidden" aria-label="Open menu">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.75rem)] grid w-72 gap-2 rounded-2xl border border-[#E3E8EF] bg-white p-2 shadow-xl">
            <nav aria-label="Main" className="grid">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-lg px-3 py-3 text-[1.05rem] font-medium text-[#0D1F31] hover:bg-[#EEF4FA]">
                  {l.label}
                </Link>
              ))}
            </nav>
            <Link href="/score" className="rounded-full bg-[#0C5290] px-4 py-3 text-center font-semibold text-white">
              Get my free BOSS Score
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-[#051E36] text-[#C9DAEA]">
      <div className="mx-auto grid max-w-[82rem] gap-4 px-5 py-7 sm:px-[clamp(1.25rem,5vw,5.5rem)] md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex flex-wrap items-center gap-5">
          <img src="/brand/profit-coach-logo-site-white.svg" alt="The Profit Coach" width={150} height={23} className="h-[1.3rem] w-auto" />
          <p className="hidden text-sm text-[#A9C1D8] md:block">Less chaos. More profit. Real freedom.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:justify-end">
          {[...LINKS, { href: "/playbooks", label: "Playbooks" }].map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col-reverse gap-4 border-t border-white/10 pt-4 md:col-span-2 md:flex-row md:items-center md:justify-between">
          <p className="text-[0.8rem] text-[#8FA9C2]">
            Are you a business coach?{" "}
            <a href="https://www.businesscoachacademy.com" className="text-[#C9DAEA] underline">Business Coach Academy</a> · © 2026 The Profit Coach ·{" "}
            <a href="https://go.theprofitcoach.com/privacy-policy" className="text-[#C9DAEA] underline">Privacy</a> ·{" "}
            <a href="https://go.theprofitcoach.com/terms-and-conditions" className="text-[#C9DAEA] underline">Terms</a>
          </p>
          <Link
            href="/login"
            className="inline-flex h-[2.6rem] items-center justify-center gap-2 rounded-full border border-white/30 px-5 text-[0.9375rem] font-semibold text-white hover:border-white/55 hover:bg-white/10"
          >
            Member login <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
