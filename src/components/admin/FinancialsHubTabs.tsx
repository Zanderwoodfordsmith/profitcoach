"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";
import { isCashFlowForecastAllowedEmail } from "@/lib/cashFlowForecastAccess";
import { supabaseClient } from "@/lib/supabaseClient";

export function FinancialsHubTabs() {
  const pathname = usePathname();
  const [cashFlowAllowed, setCashFlowAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!cancelled) {
        setCashFlowAllowed(isCashFlowForecastAllowedEmail(user?.email));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPayments =
    pathname === "/admin/payments" ||
    Boolean(pathname?.startsWith("/admin/payments/"));
  const onCashFlow =
    pathname === "/admin/cash-flow-forecast" ||
    Boolean(pathname?.startsWith("/admin/cash-flow-forecast/"));

  const items = [
    {
      kind: "link" as const,
      href: "/admin/payments",
      label: "Payments",
      active: onPayments,
    },
    ...(cashFlowAllowed
      ? [
          {
            kind: "link" as const,
            href: "/admin/cash-flow-forecast",
            label: "Cash Flow",
            active: onCashFlow,
          },
        ]
      : []),
  ];

  return (
    <PageHeaderUnderlineTabs ariaLabel="Financials views" items={items} />
  );
}
