"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MessagesSquare, X } from "lucide-react";
import { FeedbackFormCard } from "@/components/feedback/FeedbackFormCard";
import {
  adminSectionNavItems,
  deliveryNavItems,
  mainNavItems,
  marketingNavItems,
  mobileMoreNavItems,
  mobileNavShortLabel,
  mobilePrimaryNavItems,
  navLinkActive,
} from "@/components/layout/dashboardNavItems";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { profileInitialsFromName } from "@/lib/communityProfile";

export type DashboardSidebarVariant = "coach" | "admin";

type DashboardSidebarProps = {
  variant: DashboardSidebarVariant;
  signingOut?: boolean;
  onSignOut?: () => void | Promise<void>;
  avatarOverride?: {
    name: string;
    avatarUrl: string | null;
  } | null;
};

function isCommunityCalendarActive(pathname: string | null, communityHref: string) {
  return Boolean(pathname?.startsWith(`${communityHref}/calendar`));
}

export function DashboardSidebar({
  variant,
  signingOut = false,
  onSignOut,
  avatarOverride = null,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const prefix = variant === "coach" ? "/coach" : "/admin";
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const { profileLoading, avatarLabel, avatarImageUrl } =
    useDashboardProfile(avatarOverride);

  const mainItems = mainNavItems(prefix);
  const mobilePrimary = mobilePrimaryNavItems(prefix);
  const mobileMore = mobileMoreNavItems(prefix);
  const settingsHref = variant === "coach" ? "/coach/settings" : "/admin/account";

  const closeMobileSheets = () => {
    setMobileMoreOpen(false);
  };

  const renderMobileNavLink = (item: (typeof mobilePrimary)[number]) => {
    let active = navLinkActive(pathname, item.href);
    if (
      item.href === `${prefix}/community` &&
      isCommunityCalendarActive(pathname, `${prefix}/community`)
    ) {
      active = false;
    }
    const Icon = item.icon;
    const short = mobileNavShortLabel(item.label);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMobileSheets}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-center ${
          active ? "bg-sky-500/80 text-white" : "text-slate-100/90 active:bg-white/10"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-tight">
          {short}
        </span>
      </Link>
    );
  };

  const renderMoreNavLinks = (
    items: typeof mobileMore,
    onNavigate?: () => void
  ) =>
    items.map((item) => {
      const active = navLinkActive(pathname, item.href);
      const Icon = item.icon;
      return (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={() => {
              onNavigate?.();
              closeMobileSheets();
            }}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
              active
                ? "bg-sky-500/80 text-white"
                : "text-slate-100/90 hover:bg-white/10"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0 opacity-95" />
            {item.label}
          </Link>
        </li>
      );
    });

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-64 border-r border-slate-200 bg-gradient-to-b from-[#0c5290] to-[#0a4274] text-white md:flex md:flex-col">
        <div className="shrink-0 px-4 py-4">
          <Link
            href={prefix}
            className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Image
              src="/brand/profit-coach-logo-white.svg"
              alt="Profit Coach"
              width={352}
              height={99}
              className="h-[3.6rem] w-auto max-w-full"
              priority
            />
          </Link>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3">
          <ul className="space-y-1">
            {mainItems.map((item) => {
              let active = navLinkActive(pathname, item.href);
              if (
                item.href === `${prefix}/community` &&
                isCommunityCalendarActive(pathname, `${prefix}/community`)
              ) {
                active = false;
              }
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-4 py-2.5 text-base ${
                      active
                        ? "bg-sky-500/80 text-white"
                        : "text-slate-100/90 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 px-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
              Marketing
            </p>
            <ul className="space-y-0.5">
              {marketingNavItems(prefix, { includeBossScore: true }).map((item) => {
                const active = navLinkActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md px-4 py-2 text-[0.9375rem] leading-snug ${
                        active
                          ? "bg-sky-500/80 text-white"
                          : "text-slate-100/90 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 opacity-95" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          {variant === "admin" ? (
            <>
              <div className="mt-5 px-1">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                  Delivery
                </p>
                <ul className="space-y-0.5">
                  {deliveryNavItems(prefix).map((item) => {
                    const active = navLinkActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-4 py-2 text-[0.9375rem] leading-snug ${
                            active
                              ? "bg-sky-500/80 text-white"
                              : "text-slate-100/90 hover:bg-white/10"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0 opacity-95" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : null}
          {variant === "admin" && (
            <div className="mt-5 px-1">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                Admin
              </p>
              <ul className="space-y-0.5">
                {adminSectionNavItems.map((item) => {
                  const active = navLinkActive(pathname, item.href, item.coachesHub);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-md px-4 py-2 text-[0.9375rem] leading-snug ${
                          active
                            ? "bg-sky-500/80 text-white"
                            : "text-slate-100/90 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0 opacity-95" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>
        <div className="shrink-0 border-t border-white/15 px-3 py-3">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className={`flex items-center gap-3 rounded-md px-4 py-2 text-[0.9375rem] leading-snug ${
              feedbackOpen ? "bg-sky-500/80 text-white" : "text-slate-100/90 hover:bg-white/10"
            }`}
          >
            <MessagesSquare className="h-5 w-5 shrink-0 opacity-95" />
            Feedback
          </button>
        </div>
      </aside>

      {/* Mobile: 4 primary tabs + account (opens more sheet) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/15 bg-gradient-to-b from-[#0c5290] to-[#0a4274] pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-4px_24px_rgba(0,0,0,0.18)] md:hidden"
        aria-label="Main navigation"
      >
        <div className="flex min-h-[3.5rem] items-stretch">
          {mobilePrimary.map((item) => renderMobileNavLink(item))}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-center ${
              mobileMoreOpen ? "bg-sky-500/80 text-white" : "text-slate-100/90 active:bg-white/10"
            }`}
            aria-expanded={mobileMoreOpen}
            aria-label="Account and more"
          >
            {avatarImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarImageUrl}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/40"
              />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[9px] font-semibold text-white ring-1 ring-white/30">
                {profileInitialsFromName(avatarLabel)}
              </span>
            )}
            <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-tight">
              Account
            </span>
          </button>
        </div>
      </nav>

      {mobileMoreOpen ? (
        <div
          className="fixed inset-0 z-[110] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setMobileMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[min(85vh,32rem)] overflow-y-auto rounded-t-2xl border border-white/15 bg-gradient-to-b from-[#0c5290] to-[#0a4274] pb-[calc(env(safe-area-inset-bottom)+3.5rem)] pt-2 text-white shadow-xl">
            <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/25" />
            <div className="flex items-center gap-3 border-b border-white/15 px-4 py-3">
              {avatarImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarImageUrl}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30"
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white ring-2 ring-white/30">
                  {profileInitialsFromName(avatarLabel)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">
                  {profileLoading ? "Loading..." : avatarLabel}
                </p>
                <Link
                  href={settingsHref}
                  onClick={closeMobileSheets}
                  className="text-sm text-sky-200/90 hover:text-white"
                >
                  Account settings
                </Link>
              </div>
            </div>
            <div className="px-4 pb-3 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                More
              </p>
              <ul className="space-y-0.5">{renderMoreNavLinks(mobileMore)}</ul>
            </div>
            {variant === "admin" ? (
              <>
                <div className="px-4 pb-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                    Marketing
                  </p>
                  <ul className="space-y-0.5">
                    {marketingNavItems(prefix).map((item) => {
                      const active = navLinkActive(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={closeMobileSheets}
                            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
                              active
                                ? "bg-sky-500/80 text-white"
                                : "text-slate-100/90 hover:bg-white/10"
                            }`}
                          >
                            <Icon className="h-5 w-5 shrink-0 opacity-95" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="px-4 pb-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                    Delivery
                  </p>
                  <ul className="space-y-0.5">
                    {deliveryNavItems(prefix).map((item) => {
                      const active = navLinkActive(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={closeMobileSheets}
                            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
                              active
                                ? "bg-sky-500/80 text-white"
                                : "text-slate-100/90 hover:bg-white/10"
                            }`}
                          >
                            <Icon className="h-5 w-5 shrink-0 opacity-95" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="px-4 pb-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                    Admin
                  </p>
                  <ul className="space-y-0.5">
                    {adminSectionNavItems.map((item) => {
                      const active = navLinkActive(pathname, item.href, item.coachesHub);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={closeMobileSheets}
                            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
                              active
                                ? "bg-sky-500/80 text-white"
                                : "text-slate-100/90 hover:bg-white/10"
                            }`}
                          >
                            <Icon className="h-5 w-5 shrink-0 opacity-95" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            ) : null}
            <div className="border-t border-white/15 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  closeMobileSheets();
                  setFeedbackOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] text-slate-100/90 hover:bg-white/10"
              >
                <MessagesSquare className="h-5 w-5 shrink-0 opacity-95" />
                Feedback
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMobileSheets();
                  void onSignOut?.();
                }}
                disabled={signingOut}
                className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[0.9375rem] text-slate-100/90 hover:bg-white/10 disabled:opacity-60"
              >
                <LogOut className="h-5 w-5 shrink-0 opacity-95" />
                {signingOut ? "Signing out..." : "Log out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedbackOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setFeedbackOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Feedback"
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFeedbackOpen(false)}
              className="absolute -right-1 -top-1 z-10 rounded-full border border-slate-200 bg-white p-1 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
              aria-label="Close feedback"
            >
              <X className="h-4 w-4" />
            </button>
            <FeedbackFormCard />
          </div>
        </div>
      ) : null}
    </>
  );
}
