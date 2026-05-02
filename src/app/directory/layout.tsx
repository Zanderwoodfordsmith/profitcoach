import Link from "next/link";

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
            className="text-sm font-semibold tracking-tight text-slate-900"
          >
            Coach directory
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
