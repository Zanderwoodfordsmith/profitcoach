import Link from "next/link";

export default function AttendeesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-white/50 bg-[#f5f8fc]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-4 md:px-8">
          <Link
            href="/new-home"
            className="text-lg font-semibold tracking-tight text-[#0c5290] md:text-xl"
          >
            The Profit Coach
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
