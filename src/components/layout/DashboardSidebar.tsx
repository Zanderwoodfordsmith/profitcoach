"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Lock,
  LogOut,
  MessagesSquare,
  CreditCard,
  Settings,
} from "lucide-react";
import {
  adminSectionNavItemActive,
  adminSectionNavItems,
  coachClientsTabHrefs,
  coachToolsNavItems,
  getClientsHubPaths,
  isToolsHubPath,
  mainNavItems,
  mobileMoreNavItems,
  mobileNavShortLabel,
  mobilePrimaryNavItems,
  navLinkActive,
} from "@/components/layout/dashboardNavItems";
import type { CoachAccessTier, CoachFeature } from "@/lib/coachAccess/tiers";
import {
  membershipPreviewMode,
  membershipSidebarPromoEnabled,
} from "@/lib/membership/preview";
import { MembershipSidebarPromo } from "@/components/membership/MembershipSidebarPromo";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { useNewFeedbackCount } from "@/components/layout/useNewFeedbackCount";
import { profileInitialsFromName } from "@/lib/communityProfile";

/** Selected nav pill — restrained cooler-blue gradient (between solid sky and full wash). */
const SIDEBAR_NAV_ACTIVE =
  "bg-[linear-gradient(155deg,#0a6fa8_0%,#1aa3e0_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]";

export type DashboardSidebarVariant = "coach" | "admin";

type DashboardSidebarProps = {
  variant: DashboardSidebarVariant;
  signingOut?: boolean;
  onSignOut?: () => void | Promise<void>;
  avatarOverride?: {
    name: string;
    avatarUrl: string | null;
  } | null;
  /** Coach-only: used to lock gated nav items and show upgrade badges. */
  coachHasFeature?: (feature: CoachFeature) => boolean;
  /**
   * Coach-only: from resolveCoachAccess / ENFORCE_MEMBERSHIP_TIERS.
   * Join Premium stays hidden until enforcement is on.
   */
  membershipTierEnforcementEnabled?: boolean;
  /** Coach-only: hide Join Premium for members already on Premium/VIP. */
  coachAccessTier?: CoachAccessTier | null;
};

function isCommunityCalendarActive(pathname: string | null, communityHref: string) {
  return Boolean(pathname?.startsWith(`${communityHref}/calendar`));
}

const ADMIN_NAV_EXPANDED_KEY = "pc-admin-nav-expanded";

function readAdminNavExpanded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_NAV_EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function DashboardSidebar({
  variant,
  signingOut = false,
  onSignOut,
  avatarOverride = null,
  coachHasFeature,
  membershipTierEnforcementEnabled = false,
  coachAccessTier = null,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const prefix = variant === "coach" ? "/coach" : "/admin";
  const supportHref = `${prefix}/support`;
  const supportActive = Boolean(pathname?.startsWith(supportHref));
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [adminNavExpanded, setAdminNavExpanded] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const showAdminSection = variant === "admin";

  useEffect(() => {
    if (!showAdminSection) return;
    setAdminNavExpanded(readAdminNavExpanded());
  }, [showAdminSection]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [accountMenuOpen]);

  const toggleAdminNav = () => {
    setAdminNavExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(ADMIN_NAV_EXPANDED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const featureCheck =
    variant === "coach" && coachHasFeature
      ? coachHasFeature
      : () => true;

  const { profileLoading, avatarLabel, avatarImageUrl } =
    useDashboardProfile(avatarOverride);
  const newFeedbackCount = useNewFeedbackCount(variant === "admin");

  // Soft-gate model: gated items stay visible with a lock badge; clicking
  // through shows the upgrade gate on the page itself.
  const navItemLocked = (feature?: CoachFeature) =>
    feature ? !featureCheck(feature) : false;
  const lockBadge = (
    <Lock
      className="ml-auto h-3.5 w-3.5 shrink-0 text-sky-200/60"
      aria-label="Upgrade to unlock"
    />
  );

  const mainItems = mainNavItems(prefix);
  const mobilePrimary = mobilePrimaryNavItems(prefix);
  const mobileMore = mobileMoreNavItems(prefix);
  const toolsNavItems = coachToolsNavItems(prefix);
  const getClientsHrefs = getClientsHubPaths(prefix);
  const coachClientsHrefs = coachClientsTabHrefs(prefix);
  const isToolsNavActive = (itemHref: string) => {
    if (itemHref === `${prefix}/prospects`) {
      return isToolsHubPath(pathname, getClientsHrefs);
    }
    if (itemHref === `${prefix}/clients`) {
      return isToolsHubPath(pathname, coachClientsHrefs);
    }
    return navLinkActive(pathname, itemHref);
  };
  const settingsHref = variant === "coach" ? "/coach/settings" : "/admin/account";
  const settingsActive =
    pathname === settingsHref || Boolean(pathname?.startsWith(`${settingsHref}/`));
  const alreadyPremiumOrVip =
    coachAccessTier === "premium" || coachAccessTier === "vip";
  const inProgrammeBuild = coachAccessTier === "programme";
  const sidebarPromoSoftLaunch = membershipSidebarPromoEnabled();
  // Join Premium only after ENFORCE_MEMBERSHIP_TIERS is on, and never for
  // Premium/VIP or coaches still in the first-6-months programme.
  const showJoinPremiumPromo =
    variant === "coach" &&
    sidebarPromoSoftLaunch &&
    membershipTierEnforcementEnabled &&
    !alreadyPremiumOrVip &&
    !inProgrammeBuild;
  // Soft-launch: hide Membership until promo/enforcement is live; Premium/VIP
  // (and programme coaches) still get the Membership link once tiers are enforced.
  const showMembershipNav =
    variant === "coach" &&
    !membershipPreviewMode() &&
    (!sidebarPromoSoftLaunch ||
      (membershipTierEnforcementEnabled &&
        (alreadyPremiumOrVip || inProgrammeBuild)));
  const membershipPageActive =
    pathname === "/coach/membership" || pathname === "/membership";

  const closeMobileSheets = () => {
    setMobileMoreOpen(false);
  };

  const renderFeedbackInboxBadge = (href: string) => {
    if (href !== "/admin/community/feedback" || newFeedbackCount <= 0) return null;
    return (
      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white">
        {newFeedbackCount > 99 ? "99+" : newFeedbackCount}
      </span>
    );
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
    const locked = navItemLocked(item.requiredFeature);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMobileSheets}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-center ${
          active ? SIDEBAR_NAV_ACTIVE : "text-slate-100/90 active:bg-white/10"
        }`}
      >
        <span className="relative shrink-0">
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          {locked ? (
            <Lock
              className="absolute -right-2 -top-1 h-3 w-3 rounded-full bg-[#0a4274] p-[1px] text-sky-200/80"
              aria-label="Upgrade to unlock"
            />
          ) : null}
        </span>
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
                ? SIDEBAR_NAV_ACTIVE
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
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-56 border-r border-white/10 bg-[linear-gradient(165deg,#051e36_0%,#0c5290_48%,#1a8fd4_100%)] text-white md:flex md:flex-col">
        {/* Align thick logo pillars (not the thin swoosh tip) with nav icons. */}
        <div className="shrink-0 pb-4 pl-[9px] pr-4 pt-1.5">
          <Link
            href={prefix}
            className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Image
              src="/brand/profit-coach-logo-white.svg"
              alt="Profit Coach"
              width={352}
              height={99}
              className="h-[3.25rem] w-auto max-w-full"
              priority
            />
          </Link>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3">
          <ul className="space-y-0.5">
            {mainItems.map((item) => {
              let active = navLinkActive(pathname, item.href);
              if (
                item.href === `${prefix}/community` &&
                isCommunityCalendarActive(pathname, `${prefix}/community`)
              ) {
                active = false;
              }
              const Icon = item.icon;
              const locked = navItemLocked(item.requiredFeature);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-4 py-2.5 text-[0.9375rem] leading-snug ${
                      active
                        ? SIDEBAR_NAV_ACTIVE
                        : "text-slate-100/90 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0 opacity-95" />
                    {item.label}
                    {locked ? lockBadge : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 px-1">
            <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
              Tools
            </p>
            <ul className="space-y-0.5">
              {toolsNavItems.map((item) => {
                const active = isToolsNavActive(item.href);
                const Icon = item.icon;
                const locked =
                  variant === "coach" && navItemLocked(item.requiredFeature);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md px-4 py-2.5 text-[0.9375rem] leading-snug ${
                        active
                          ? SIDEBAR_NAV_ACTIVE
                          : "text-slate-100/90 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 opacity-95" />
                      {item.label}
                      {locked ? lockBadge : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
        {showAdminSection ? (
          <div className="shrink-0 px-3 pb-2 pt-1">
            {adminNavExpanded ? (
              <div className="mb-1">
                <button
                  type="button"
                  onClick={toggleAdminNav}
                  aria-expanded={true}
                  aria-label="Collapse admin menu"
                  className="mb-1 flex w-full items-center gap-2 rounded-md px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55 hover:bg-white/10 hover:text-sky-100"
                >
                  <span className="min-w-0 flex-1 text-left">Admin</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </button>
                <ul className="space-y-0.5 px-1">
                  {adminSectionNavItems.map((item) => {
                    const active = adminSectionNavItemActive(pathname, item);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-4 py-2 text-[0.9375rem] leading-snug ${
                            active
                              ? SIDEBAR_NAV_ACTIVE
                              : "text-slate-100/90 hover:bg-white/10"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0 opacity-95" />
                          <span className="min-w-0 flex-1">{item.label}</span>
                          {renderFeedbackInboxBadge(item.href)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <button
                type="button"
                onClick={toggleAdminNav}
                aria-expanded={false}
                className="flex w-full items-center gap-2 rounded-md px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55 hover:bg-white/10 hover:text-sky-100"
              >
                <span className="min-w-0 flex-1 text-left">Admin</span>
                <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
            )}
          </div>
        ) : null}
        <div className="shrink-0 border-t border-white/15 px-3 py-3">
          {showJoinPremiumPromo ? (
            <MembershipSidebarPromo active={membershipPageActive} />
          ) : null}
          {showMembershipNav ? (
            <Link
              href="/coach/membership"
              className={`mb-1 flex items-center gap-3 rounded-md px-4 py-2 text-[0.9375rem] leading-snug ${
                membershipPageActive
                  ? SIDEBAR_NAV_ACTIVE
                  : "text-slate-100/90 hover:bg-white/10"
              }`}
            >
              <CreditCard className="h-5 w-5 shrink-0 opacity-95" />
              Membership
            </Link>
          ) : null}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[0.9375rem] leading-snug ${
                accountMenuOpen || settingsActive || supportActive
                  ? SIDEBAR_NAV_ACTIVE
                  : "text-slate-100/90 hover:bg-white/10"
              }`}
            >
              {avatarImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarImageUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/35"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold text-white ring-1 ring-white/30">
                  {profileInitialsFromName(avatarLabel)}
                </span>
              )}
              <span className="min-w-0 flex-1 text-[0.8125rem] font-medium leading-snug line-clamp-2">
                {profileLoading ? "Loading..." : avatarLabel}
              </span>
            </button>
            {accountMenuOpen ? (
              <div
                role="menu"
                className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {profileLoading ? "Loading..." : avatarLabel}
                  </p>
                </div>
                <Link
                  href={settingsHref}
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <Settings className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Settings
                </Link>
                <Link
                  href={supportHref}
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <MessagesSquare className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Support
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    void onSignOut?.();
                  }}
                  disabled={signingOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  {signingOut ? "Signing out..." : "Log out"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Mobile: 4 primary tabs + settings (opens more sheet) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/15 bg-[linear-gradient(165deg,#051e36_0%,#0c5290_48%,#1a8fd4_100%)] pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-4px_24px_rgba(0,0,0,0.18)] md:hidden"
        aria-label="Main navigation"
      >
        <div className="flex min-h-[3.5rem] items-stretch">
          {mobilePrimary.map((item) => renderMobileNavLink(item))}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-center ${
              mobileMoreOpen ? SIDEBAR_NAV_ACTIVE : "text-slate-100/90 active:bg-white/10"
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
              {profileLoading ? "…" : avatarLabel.split(" ")[0] || "You"}
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
          <div className="absolute inset-x-0 bottom-0 max-h-[min(85vh,32rem)] overflow-y-auto rounded-t-2xl border border-white/15 bg-[linear-gradient(165deg,#051e36_0%,#0c5290_48%,#1a8fd4_100%)] pb-[calc(env(safe-area-inset-bottom)+3.5rem)] pt-2 text-white shadow-xl">
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
              </div>
            </div>
            {variant === "admin" ? (
              <div className="px-4 pb-3 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                  More
                </p>
                <ul className="space-y-0.5">{renderMoreNavLinks(mobileMore)}</ul>
              </div>
            ) : null}
            <div className="px-4 pb-3 pt-3">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                Tools
              </p>
              <ul className="space-y-0.5">
                {toolsNavItems.map((item) => {
                  const active = isToolsNavActive(item.href);
                  const Icon = item.icon;
                  const locked =
                    variant === "coach" && navItemLocked(item.requiredFeature);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={closeMobileSheets}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
                          active
                            ? SIDEBAR_NAV_ACTIVE
                            : "text-slate-100/90 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0 opacity-95" />
                        {item.label}
                        {locked ? lockBadge : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            {showAdminSection ? (
              <div className="px-4 pb-3">
                {adminNavExpanded ? (
                  <div>
                    <button
                      type="button"
                      onClick={toggleAdminNav}
                      aria-expanded={true}
                      aria-label="Collapse admin menu"
                      className="mb-2 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55 hover:bg-white/10 hover:text-sky-100"
                    >
                      <span className="min-w-0 flex-1 text-left">Admin</span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </button>
                    <ul className="space-y-0.5">
                      {adminSectionNavItems.map((item) => {
                        const active = adminSectionNavItemActive(pathname, item);
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={closeMobileSheets}
                              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
                                active
                                  ? SIDEBAR_NAV_ACTIVE
                                  : "text-slate-100/90 hover:bg-white/10"
                              }`}
                            >
                              <Icon className="h-5 w-5 shrink-0 opacity-95" />
                              <span className="min-w-0 flex-1">{item.label}</span>
                              {renderFeedbackInboxBadge(item.href)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={toggleAdminNav}
                    aria-expanded={false}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55 hover:bg-white/10 hover:text-sky-100"
                  >
                    <span className="min-w-0 flex-1 text-left">Admin</span>
                    <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </button>
                )}
              </div>
            ) : null}
            <div className="border-t border-white/15 px-4 py-3">
              {showJoinPremiumPromo ? (
                <MembershipSidebarPromo
                  active={membershipPageActive}
                  onNavigate={closeMobileSheets}
                  className="mb-1"
                />
              ) : null}
              {showMembershipNav ? (
                <Link
                  href="/coach/membership"
                  onClick={closeMobileSheets}
                  className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
                    membershipPageActive
                      ? SIDEBAR_NAV_ACTIVE
                      : "text-slate-100/90 hover:bg-white/10"
                  }`}
                >
                  <CreditCard className="h-5 w-5 shrink-0 opacity-95" />
                  Membership
                </Link>
              ) : null}
              <p className="mb-1 mt-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
                Settings
              </p>
              <Link
                href={settingsHref}
                onClick={closeMobileSheets}
                className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
                  settingsActive
                    ? SIDEBAR_NAV_ACTIVE
                    : "text-slate-100/90 hover:bg-white/10"
                }`}
              >
                <Settings className="h-5 w-5 shrink-0 opacity-95" />
                Settings
              </Link>
              <Link
                href={supportHref}
                onClick={closeMobileSheets}
                className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] ${
                  supportActive
                    ? SIDEBAR_NAV_ACTIVE
                    : "text-slate-100/90 hover:bg-white/10"
                }`}
              >
                <MessagesSquare className="h-5 w-5 shrink-0 opacity-95" />
                Support
              </Link>
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
    </>
  );
}
