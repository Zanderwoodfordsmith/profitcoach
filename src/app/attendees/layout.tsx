import Image from "next/image";
import Link from "next/link";

export default function AttendeesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-white/50 bg-[#f5f8fc]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-start px-5 py-3 md:px-8 md:py-4">
          <Link
            href="/new-home"
            className="inline-flex shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290] focus-visible:ring-offset-2"
          >
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={200}
              height={56}
              className="h-9 w-auto object-contain object-left md:h-10"
              priority
            />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
