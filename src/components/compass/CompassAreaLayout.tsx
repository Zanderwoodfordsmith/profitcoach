"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { PageHeaderUnderlineTabs, StickyPageHeader } from "@/components/layout";

export function CompassAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const base = pathname.startsWith("/admin")
    ? "/admin/signature"
    : "/coach/signature";
  const onCompassHome =
    pathname === base || pathname === `${base}/`;
  const isLadder = pathname === `${base}/ladder`;

  const description = isLadder
    ? "Track your levels, achievements, and goal on the ladder."
    : "Tap the circle beside each line to score. The model updates as you go.";

  const tabs = useMemo(
    () => (
      <PageHeaderUnderlineTabs
        ariaLabel="Compass views"
        items={[
          {
            kind: "link",
            href: base,
            label: "My Compass",
            active: onCompassHome,
          },
          {
            kind: "link",
            href: `${base}/ladder`,
            label: "My Ladder",
            active: isLadder,
          },
        ]}
      />
    ),
    [base, isLadder, onCompassHome],
  );

  return (
    <>
      <StickyPageHeader
        title="Compass"
        description={description}
        tabs={tabs}
      />
      <div className="pl-4 sm:pl-5 md:pl-6">{children}</div>
    </>
  );
}
