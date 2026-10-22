"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ProfitLevers } from "@/components/profitLevers/ProfitLevers";
import { ProfitTargetsBoard } from "@/components/profitLevers/targets/ProfitTargetsBoard";

/** Version 2 (the Targets tab look) by default; ?v=1 keeps the first version to compare. */
function Versions() {
  const params = useSearchParams();
  const pathname = usePathname();
  const business = params.get("business");
  const first = params.get("v") === "1";
  const hrefFor = (v: "1" | "2") => {
    const next = new URLSearchParams(params);
    if (v === "1") next.set("v", "1");
    else next.delete("v");
    return `${pathname}${next.size ? `?${next}` : ""}`;
  };
  return (
    <>
      <p className="mb-3 flex justify-end gap-2 text-sm text-slate-500">
        Version
        {(["1", "2"] as const).map((v) => (
          <Link
            key={v}
            href={hrefFor(v)}
            scroll={false}
            className={(v === "1") === first ? "font-semibold text-[#0c5290]" : "hover:text-slate-700"}
            aria-current={(v === "1") === first ? "page" : undefined}
          >
            {v}
          </Link>
        ))}
      </p>
      {first ? <ProfitLevers business={business} /> : <ProfitTargetsBoard business={business} />}
    </>
  );
}

export default function ProfitLeversPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Keep Clients"
        description="Show an owner where the business is now and what it could be. Put in their numbers and three profit targets, then drag."
        tabs={<CoachToolsHubTabs hub="coach-clients" />}
      />
      <Suspense fallback={null}>
        <Versions />
      </Suspense>
    </div>
  );
}
