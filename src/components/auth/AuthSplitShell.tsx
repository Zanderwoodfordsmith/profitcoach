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
          <div className="relative flex min-h-0 w-full flex-1 overflow-hidden rounded-3xl shadow-xl ring-1 ring-slate-200/80">
            <Image
              src="/landing/v2/hero.png"
              alt=""
              fill
              className="object-cover"
              priority
              sizes="50vw"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--landing-navy)]/92 via-[var(--landing-navy)]/25 to-transparent" />
            <div className="relative z-10 flex w-full flex-col justify-between p-8 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 shadow-md backdrop-blur-sm">
                  <Image
                    src="/landing/v2/icon-vision.png"
                    alt=""
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <span className="text-lg font-semibold tracking-tight">
                  BOSS Dashboard
                </span>
              </div>
              <div className="mt-auto max-w-md rounded-2xl border border-white/25 bg-white/10 p-6 shadow-lg backdrop-blur-md">
                <p className="text-lg font-medium leading-relaxed text-white">
                  &ldquo;Structure your coaching practice the way you structure
                  results for clients: clear, visible, repeatable.&rdquo;
                </p>
                <p className="mt-4 text-sm text-white/85">
                  Built for coaches who run on the BOSS methodology
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
