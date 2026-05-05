import Link from "next/link";
import Image from "next/image";

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/directory"
            className="inline-flex items-center"
            aria-label="Profit Coach directory"
          >
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={260}
              height={58}
              className="h-10 w-auto object-contain sm:h-11"
              priority
            />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-sky-700 hover:text-sky-900"
          >
            Sign in
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
