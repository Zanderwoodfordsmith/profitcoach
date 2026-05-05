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
        <div className="flex min-h-screen w-full bg-slate-100 px-10 py-12 xl:px-14">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center">
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={640}
              height={180}
              className="h-auto w-full max-w-xl rounded-xl bg-slate-100 object-contain"
              priority
              sizes="(max-width: 1279px) 44vw, 620px"
            />
            <div className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-5">
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
