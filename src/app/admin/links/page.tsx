"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { adminExtraNavLinks } from "@/config/adminExtraNavLinks";
import { supabaseClient } from "@/lib/supabaseClient";

const siteToolsLinks = [
  {
    href: "/admin/settings/ai-coach",
    label: "AI Coach system prompt",
    hint: "Control how the Coaching AI behaves for clients.",
  },
  {
    href: "/admin/settings/linkedin-profile",
    label: "LinkedIn Profile Optimizer prompt",
    hint: "Rewrite voice for headline, About, Featured, experience, and banner.",
  },
  {
    href: "/admin/settings/boss-grid",
    label: "Boss Grid variations",
    hint: "All grid components (transposed, default, glass, bordered).",
  },
  {
    href: "/admin/account?tab=calendar",
    label: "My native booking (hours)",
    hint: "Set your own availability — no impersonation. Book link appears on that page after save.",
  },
  {
    href: "/zander",
    label: "My public book page (/zander)",
    hint: "Enable Native discovery booking in Settings → Calendar, then share this URL.",
  },
] as const;

const linkItems = [
  { href: "/login", label: "Login" },
  { href: "/preview/thank-you", label: "Thank you (Completed)" },
];

const reportPreviewLinks = [
  {
    href: "/preview/report",
    label: "AI report preview",
    hint: "Progress bars + AI insight dashboard with seeded demo data.",
  },
  {
    href: "/preview/report-design-system",
    label: "BOSS report (design system)",
    hint: "Brand canvas, glass hero, pillars / levels / areas, charts.",
  },
  {
    href: "/preview/report-v3?preview=1&score=47&coach=BCA",
    label: "BOSS report v3 (legacy diagnostic)",
    hint: "Hero dial, level cards, pillar dials for 50-q diagnostic.",
  },
  {
    href: "/preview/boss-pro-report?preview=1&coach=BCA",
    label: "Boss Pro report (demo)",
    hint: "Full 50-question report with coach + level preview controls.",
  },
  {
    href: "/preview/scorecard-results?preview=1&coach=pam",
    label: "BOSS Scorecard results",
    hint: "New 13-question scorecard results page.",
  },
  {
    href: "/preview/scorecard",
    label: "BOSS Scorecard UI",
    hint: "Smiley scale and progress bar preview.",
  },
] as const;

const bossProgrammeLinks = [
  {
    href: "/landing/a?coach=BCA",
    label: "Landing page",
    hint: "Public opt-in page (variant A).",
  },
  {
    href: "/assessment/BCA",
    label: "BOSS Scorecard",
    hint: "13-question scorecard flow after landing opt-in.",
  },
  {
    href: "/assessment/pam/thank-you?preview=1&coach=pam",
    label: "Scorecard results",
    hint: "Post-scorecard results experience.",
  },
  {
    href: "/assessment-pro/BCA",
    label: "Boss Pro assessment",
    hint: "50-question Boss Pro flow (direct link).",
  },
  {
    href: "/preview/boss-pro-report?preview=1&coach=BCA",
    label: "Boss Pro report (demo)",
    hint: "Full 50-question report with coach + level preview controls.",
  },
  {
    href: "/admin/prospects",
    label: "Internal prospect dashboard",
    hint: "Open prospects, then select a prospect record.",
  },
  {
    href: "/admin/landing-analytics",
    label: "Landing analytics",
    hint: "Boss Score landing views, opt-ins, and per-coach breakdown.",
  },
] as const;

/** Post-Stripe onboarding — skip payment, walk the real screens. */
const programmeOnboardingLinks = [
  {
    href: "/welcome",
    label: "Welcome (open / backup)",
    hint: "No checkout required — video, booking, and login help if something went wrong.",
  },
  {
    href: "/welcome?preview=1",
    label: "Just paid → welcome",
    hint: "Post-checkout welcome (password optional). Continue into Start Here without Stripe.",
  },
  {
    href:
      "/welcome?first_name=Alex&last_name=Coach&email=alex@example.com&phone=%2B447700900123&linkedin=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fexample",
    label: "GHL welcome link (prefill test)",
    hint: "No login required. Prefills name, email, phone, LinkedIn for booking + intake.",
  },
  {
    href: "/coach/academy/classroom/start-here/start-here-welcome-welcome-program-overview",
    label: "Start Here (first lesson)",
    hint: "Skip welcome; jump straight into the first classroom screen after payment.",
  },
  {
    href: "/join/pay-in-full",
    label: "Join — pay in full (£2 test)",
    hint: "Clean split checkout. Closer-only link — no plan switcher.",
  },
  {
    href: "/join/two-pay",
    label: "Join — 2-pay (£1 × 2 test)",
    hint: "Clean split checkout. CTA shows Pay 2 × £1; only two payments then stops.",
  },
  {
    href: "/join/3x1",
    label: "Join — 3 × £1 (test)",
    hint: "Same checkout as 3 × £3,300, using the £1 × 3 Stripe price.",
  },
  {
    href: "/join/3x1/embed",
    label: "Join — 3 × £1 (Embedded preview)",
    hint: "Embedded Checkout preview for the £1 × 3 test price.",
  },
  {
    href: "/join/9900",
    label: "Join — 1 × £9,900",
    hint: "UK closer link. One payment of £9,900.",
  },
  {
    href: "/join/2x4950",
    label: "Join — 2 × £4,950",
    hint: "UK closer link. Two payments of £4,950 (total £9,900).",
  },
  {
    href: "/join/3x3300",
    label: "Join — 3 × £3,300",
    hint: "UK closer link. Three payments of £3,300 (total £9,900).",
  },
  {
    href: "/join/4x2600",
    label: "Join — 4 × £2,600",
    hint: "UK closer link. Four payments of £2,600 (total £10,400).",
  },
  {
    href: "/join/6x1750",
    label: "Join — 6 × £1,750",
    hint: "UK closer link. Six payments of £1,750 (total £10,500).",
  },
  {
    href: "/join/12900",
    label: "Join — 1 × $12,900",
    hint: "US closer link. One payment of $12,900.",
  },
  {
    href: "/join/2x6450",
    label: "Join — 2 × $6,450",
    hint: "US closer link. Two payments of $6,450 (total $12,900).",
  },
  {
    href: "/join/3x4300",
    label: "Join — 3 × $4,300",
    hint: "US closer link. Three payments of $4,300 (total $12,900).",
  },
  {
    href: "/join/4x3400",
    label: "Join — 4 × $3,400",
    hint: "US closer link. Four payments of $3,400 (total $13,600).",
  },
  {
    href: "/join/6x2300",
    label: "Join — 6 × $2,300",
    hint: "US closer link. Six payments of $2,300 (total $13,800).",
  },
  {
    href: "/join/9900/embed",
    label: "Join — £9,900 (Embedded preview)",
    hint: "Same left summary; Stripe Embedded Checkout on the right.",
  },
  {
    href: "/join/3x3300/embed",
    label: "Join — 3 × £3,300 (Embedded preview)",
    hint: "Same left summary; Stripe Embedded Checkout on the right.",
  },
  {
    href: "/join",
    label: "Join — default hosted checkout",
    hint: "Redirects straight into Stripe Checkout (no offer page).",
  },
] as const;

function LinkGroup({
  title,
  items,
  origin,
  openInSameTab = false,
}: {
  title: string;
  items: readonly { href: string; label: string; hint?: string }[];
  origin: string;
  openInSameTab?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const fullUrl = origin ? `${origin}${item.href}` : item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                {...(openInSameTab
                  ? {}
                  : { target: "_blank", rel: "noreferrer" })}
                className={`flex ${
                  item.hint ? "flex-col gap-0.5" : "flex-wrap items-center justify-between gap-2"
                } px-4 py-3 text-sm text-slate-900 hover:bg-slate-50`}
              >
                {item.hint ? (
                  <>
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{item.label}</span>
                      {!openInSameTab ? (
                        <span className="truncate text-xs text-slate-500">{fullUrl}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-slate-500">{item.hint}</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{item.label}</span>
                    <span className="truncate text-xs text-slate-500">{fullUrl}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AdminLinksPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (cancelled) return;
      if (!roleRes.ok || roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }
      setCheckingRole(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <DashboardPageSection
      header={
        <StickyPageHeader
          title="Links"
          description="Post-payment onboarding preview at the top, then site tools, report previews, and pages outside the sidebar."
          tabs={<ToolkitHubTabs />}
        />
      }
    >
      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <LinkGroup
            title="Test post-payment onboarding"
            items={programmeOnboardingLinks}
            origin={origin}
            openInSameTab
          />
          <LinkGroup
            title="Site tools"
            items={siteToolsLinks}
            origin={origin}
            openInSameTab
          />
          <LinkGroup title="Quick links" items={linkItems} origin={origin} />
          <LinkGroup
            title="Report previews"
            items={reportPreviewLinks}
            origin={origin}
          />
          <LinkGroup
            title="Boss Programme flow"
            items={bossProgrammeLinks}
            origin={origin}
          />
          <LinkGroup
            title="Pages outside the sidebar"
            items={adminExtraNavLinks}
            origin={origin}
          />
        </div>
      )}
    </DashboardPageSection>
  );
}
