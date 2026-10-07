import Link from "next/link";

export default function CoachPageNotAvailable() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-start justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
        Not available
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        This page isn’t part of your account
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        That link is for the Profit Coach team. Nothing here was opened for
        you. Head back into the app, or contact support if a link you were
        given should have worked.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/coach/community"
          className="inline-flex items-center rounded-lg bg-[#0c5290] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a4274]"
        >
          Community
        </Link>
        <Link
          href="/coach/academy/classroom"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Classroom
        </Link>
        <Link
          href="/coach/support"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Support
        </Link>
      </div>
    </div>
  );
}
