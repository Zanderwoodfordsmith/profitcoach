"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Filter,
  Layers,
  LogOut,
  MessagesSquare,
  Sparkles,
} from "lucide-react";

export type DashboardSidebarVariant = "coach" | "admin";

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
};

type AdminSectionNavItem = NavItem & {
  /** Highlights for /admin roster and /admin/client-success */
  coachesHub?: boolean;
};

function IconCog({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconBriefcase({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  );
}

function IconBookOpen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-2.992.502V6H18c.97 0 1.885.428 2.5 1.1a3.744 3.744 0 012.5 1.1V4.502A8.967 8.967 0 0018 3.75c-1.052 0-2.062.18-2.992.502A8.967 8.967 0 0012 6.042zM12 18.042a8.967 8.967 0 006-2.292c1.052 0 2.062.18 2.992.502V18H6v-1.75c.97 0 1.885.428 2.5 1.1a3.744 3.744 0 002.5 1.1 8.967 8.967 0 006-2.292zM12 18.042a8.967 8.967 0 01-6-2.292c-1.052 0-2.062.18-2.992.502V18H18v-1.75a8.968 8.968 0 00-2.5-1.1 3.744 3.744 0 00-2.5-1.1 8.967 8.967 0 01-6 2.292z" />
    </svg>
  );
}

function IconCompass({ className }: { className?: string }) {
  return <Compass className={className} />;
}

function IconLayers({ className }: { className?: string }) {
  return <Layers className={className} />;
}

function IconAcademy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l7-3.5L12 7 5 10.5 12 14z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5V16.5l7 3.5 7-3.5v-6M5 16.5l7 3.5 7-3.5" />
    </svg>
  );
}

function IconFilter({ className }: { className?: string }) {
  return <Filter className={className} />;
}

function IconSparkles({ className }: { className?: string }) {
  return <Sparkles className={className} />;
}

function IconMessagesSquare({ className }: { className?: string }) {
  return <MessagesSquare className={className} />;
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function mainNavItems(prefix: "/coach" | "/admin"): NavItem[] {
  return [
    { href: `${prefix}/community`, label: "Community", icon: IconMessagesSquare },
    { href: `${prefix}/signature`, label: "Compass", icon: IconCompass },
    {
      href: `${prefix}/community/ladder`,
      label: "My ladder",
      icon: IconLayers,
    },
    { href: `${prefix}/academy`, label: "Classroom", icon: IconAcademy },
  ];
}

function marketingNavItems(prefix: "/coach" | "/admin"): NavItem[] {
  return [
    { href: `${prefix}/prospects`, label: "Prospects", icon: IconUserPlus },
    { href: `${prefix}/funnel-analyzer`, label: "Funnel Analyzer", icon: IconFilter },
    { href: `${prefix}/message-generator`, label: "AI", icon: IconSparkles },
  ];
}

function deliveryNavItems(prefix: "/coach" | "/admin"): NavItem[] {
  return [
    { href: `${prefix}/clients`, label: "Clients", icon: IconBriefcase },
    { href: `${prefix}/playbooks`, label: "Playbooks", icon: IconBookOpen },
  ];
}

const adminSectionNavItems: AdminSectionNavItem[] = [
  { href: "/admin", label: "Coaches", icon: IconUsers, coachesHub: true },
  { href: "/admin/settings", label: "Settings", icon: IconCog },
];

function navLinkActive(
  pathname: string | null,
  href: string,
  coachesHub?: boolean,
) {
  if (coachesHub) {
    return (
      pathname === "/admin" ||
      pathname === "/admin/" ||
      pathname === "/admin/client-success" ||
      Boolean(pathname?.startsWith("/admin/client-success/"))
    );
  }
  const root = href.split("/").slice(0, 2).join("/");
  return (
    pathname === href ||
    (href !== root && Boolean(pathname?.startsWith(`${href}/`)))
  );
}

type DashboardSidebarProps = {
  variant: DashboardSidebarVariant;
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
};

export function DashboardSidebar({
  variant,
  signingOut,
  onSignOut,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const prefix = variant === "coach" ? "/coach" : "/admin";
  const roleLabel = variant === "coach" ? "Coach" : "Admin";

  const footer =
    variant === "coach"
      ? {
          href: "/coach/settings",
          title: "Settings",
          subtitle: "Profile & prospect link",
          active: Boolean(pathname?.startsWith("/coach/settings")),
        }
      : {
          href: "/admin/account",
          title: "Account",
          subtitle: "Settings & links",
          active: Boolean(pathname?.startsWith("/admin/account")),
        };

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-gradient-to-b from-[#0c5290] to-[#0a4274] text-white">
      <div className="shrink-0 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
          BOSS Dashboard
        </p>
        <p className="text-sm font-semibold">{roleLabel}</p>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3">
        <ul className="space-y-1">
          {mainNavItems(prefix).map((item) => {
            const active = navLinkActive(pathname, item.href);
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
            {marketingNavItems(prefix).map((item) => {
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
        {variant === "admin" && (
          <div className="mt-5 px-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/55">
              Admin
            </p>
            <ul className="space-y-0.5">
              {adminSectionNavItems.map((item) => {
                const active = navLinkActive(
                  pathname,
                  item.href,
                  item.coachesHub,
                );
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
      <Link
        href={footer.href}
        className={`flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-4 text-sm transition-colors ${
          footer.active
            ? "bg-sky-500/80 text-white"
            : "text-slate-100/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        <IconCog className="h-5 w-5 shrink-0" />
        <div className="flex flex-col">
          <span className="font-semibold">{footer.title}</span>
          <span className="text-xs opacity-80">{footer.subtitle}</span>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => void onSignOut()}
        disabled={signingOut}
        className="flex w-full shrink-0 items-center gap-3 border-t border-white/10 px-4 py-3 text-left text-sm text-slate-100/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span className="font-semibold">
          {signingOut ? "Signing out…" : "Log out"}
        </span>
      </button>
    </aside>
  );
}
