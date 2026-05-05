"use client";

import Image from "next/image";
import type { ReactNode } from "react";

export const authInputClassName =
  "block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--landing-navy)] focus:ring-2 focus:ring-[var(--boss-velocity)]/20";

export const authLabelClassName =
  "block text-sm font-medium text-slate-700";

export const authPrimaryButtonClassName =
  "mt-2 flex w-full items-center justify-center rounded-lg bg-[var(--landing-navy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60";

type AuthSplitShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthSplitShell({
  title,
  subtitle,
  children,
  footer,
}: AuthSplitShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:max-w-none lg:flex-1 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-[420px]">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            {subtitle}
          </p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </div>

      <div className="relative hidden min-h-0 flex-1 lg:flex">
        <div className="flex min-h-screen w-full items-stretch bg-gradient-to-br from-slate-100 via-slate-50 to-[var(--boss-velocity)]/20 p-8 xl:p-12">
          <div className="relative flex min-h-0 w-full flex-1 flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex items-start justify-center pt-2">
              <Image
                src="/brand/profit-coach-logo-colour-no-bg.png"
                alt="Profit Coach"
                width={640}
                height={180}
                className="h-auto w-full max-w-xl object-contain"
                priority
                sizes="(max-width: 1279px) 44vw, 620px"
              />
            </div>
            <div className="mt-auto max-w-md rounded-2xl border border-[var(--landing-navy)]/15 bg-[var(--landing-navy)]/[0.03] p-6 shadow-sm">
              <p className="text-lg font-medium leading-relaxed text-slate-900">
                &ldquo;Structure your coaching practice the way you structure
                results for clients: clear, visible, repeatable.&rdquo;
              </p>
              <p className="mt-4 text-sm text-slate-600">
                Built for coaches who use Profit Coach
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
