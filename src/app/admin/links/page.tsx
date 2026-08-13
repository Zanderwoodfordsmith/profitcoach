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
    href: "/join/three-pay",
    label: "Join — 3-pay hybrid (£3,300 × 3 preview)",
    hint: "Branded summary + Stripe Embedded. Schedule copy shows 3 × £3,300.",
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
