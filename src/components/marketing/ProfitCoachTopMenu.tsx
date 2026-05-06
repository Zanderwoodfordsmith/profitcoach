import Link from "next/link";

const LINK_DIAGNOSTIC = "/assessment";
const LINK_COACH = "/directory";

export function ProfitCoachTopMenu() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-[#f5f8fc]/85 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
        <Link
          href="/new-home"
          className="text-lg font-semibold tracking-tight text-[#0c5290] md:text-xl"
        >
          The Profit Coach
        </Link>
        <nav className="hidden items-center gap-7 text-[0.8125rem] font-medium text-slate-600 md:flex">
          <Link href="/new-home#profit-system" className="hover:text-[#0c5290]">
            The Profit System
          </Link>
          <Link href="/how-it-works" className="hover:text-[#0c5290]">
            How It Works
          </Link>
          <Link href="/blog" className="text-[#0c5290]">
            Blog
          </Link>
          <Link href={LINK_COACH} className="hover:text-[#0c5290]">
            Find a Coach
          </Link>
        </nav>
        <Link
          href={LINK_DIAGNOSTIC}
          className="hidden rounded-full bg-[#0c5290] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#094271] md:inline-flex"
        >
          Take Diagnostic
        </Link>
      </div>
    </header>
  );
}
