"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  appOrigin: string;
};

/**
 * Funnel Settings pointer — multi-calendar management lives under Calls.
 */
export function NativeBookingSettingsCard({ appOrigin }: Props) {
  const pathname = usePathname();
  const callsHref = pathname.startsWith("/admin")
    ? "/admin/calls"
    : "/coach/calls";
  const bookExample = `${appOrigin.replace(/\/$/, "")}/book/your-slug/discovery`;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" aria-hidden />
      <div className="space-y-3 p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Native booking calendars
        </h2>
        <p className="text-sm text-slate-600">
          Discovery, Value session, Follow-up, Coaching, and Onboarding calendars
          are managed on{" "}
          <Link
            href={callsHref}
            className="font-semibold text-sky-700 hover:underline"
          >
            Calls → Calendar settings
          </Link>
          . Public links look like{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">{bookExample}</code>.
        </p>
        <p className="text-sm text-slate-600">
          Connect Google Calendar below to block busy times and create Meet
          links when someone books.
        </p>
        <Link
          href={callsHref}
          className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Open Calls settings
        </Link>
      </div>
    </section>
  );
}
