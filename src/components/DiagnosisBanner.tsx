import type { FunnelStatus } from "@/lib/funnelCompute";
import {
  INTERESTED_TO_CLOSED_TARGET,
  SENT_TO_INTERESTED_TARGET,
} from "@/lib/funnelKpis";

/** ≥20% above KPI → call out as “really strong”. */
const STRONG_VS_KPI = 1.2;

function isReallyStrong(
  rate: number | null,
  kpi: number,
  status: FunnelStatus,
): boolean {
  return (
    status === "green" &&
    rate !== null &&
    kpi > 0 &&
    rate >= kpi * STRONG_VS_KPI
  );
}

function marketingLine(
  status: FunnelStatus,
  rate: number | null,
  kpi: number,
): string {
  if (status === "na") {
    return "Add connection-request and interested numbers to size up marketing.";
  }
  if (status === "green") {
    if (isReallyStrong(rate, kpi, status)) {
      return "Marketing is really strong — connection requests → interested is well above target.";
    }
    return "Marketing is on target for turning outreach into interest.";
  }
  if (status === "yellow") {
    return "Marketing is only slightly soft — a small drop-off from connection requests to interested, not a full gap yet.";
  }
  return "Marketing has a real gap — you’re not generating enough interest from your outreach.";
}

function salesLine(
  status: FunnelStatus,
  rate: number | null,
  kpi: number,
): string {
  if (status === "na") {
    return "Add interested and closed numbers to size up sales.";
  }
  if (status === "green") {
    if (isReallyStrong(rate, kpi, status)) {
      return "Sales is really strong — interested → closed is clearly above target.";
    }
    return "Sales is on target for turning interest into clients.";
  }
  if (status === "yellow") {
    return "Sales is only slightly soft — interested → closed is a little under where it should be.";
  }
  return "Sales has a real gap — interested prospects aren’t becoming clients at the rate you need.";
}

export function DiagnosisBanner({
  marketingStatus,
  salesStatus,
  marketingRate,
  salesRate,
}: {
  marketingStatus: FunnelStatus;
  salesStatus: FunnelStatus;
  marketingRate: number | null;
  salesRate: number | null;
}) {
  const mk = SENT_TO_INTERESTED_TARGET;
  const sk = INTERESTED_TO_CLOSED_TARGET;

  const marketingProblem =
    marketingStatus === "red" || marketingStatus === "yellow";
  const salesProblem = salesStatus === "red" || salesStatus === "yellow";
  const marketingGreen = marketingStatus === "green";
  const salesGreen = salesStatus === "green";

  const mStrong = isReallyStrong(marketingRate, mk, marketingStatus);
  const sStrong = isReallyStrong(salesRate, sk, salesStatus);

  let headline = "Where to focus";
  if (marketingGreen && salesGreen) {
    if (mStrong && sStrong) {
      headline = "Marketing and sales both strong";
    } else if (mStrong || sStrong) {
      headline = "Strong funnel health";
    } else {
      headline = "Both composites on track";
    }
  } else if (marketingProblem && salesProblem) {
    if (marketingStatus === "yellow" && salesStatus === "yellow") {
      headline = "Slight dips in marketing and sales";
    } else if (marketingStatus === "red" && salesStatus === "red") {
      headline = "Marketing and sales both under pressure";
    } else {
      headline = "Gaps in marketing and sales";
    }
  } else if (marketingProblem && !salesProblem) {
    headline =
      marketingStatus === "yellow"
        ? "Slight marketing dip"
        : "Marketing needs attention";
  } else if (!marketingProblem && salesProblem) {
    headline =
      salesStatus === "yellow" ? "Slight sales dip" : "Sales needs attention";
  } else if (marketingGreen && salesStatus === "na") {
    headline = mStrong
      ? "Strong marketing — add sales numbers to finish the picture"
      : "Marketing on track — add sales numbers to finish the picture";
  } else if (salesGreen && marketingStatus === "na") {
    headline = sStrong
      ? "Strong sales — add marketing numbers to finish the picture"
      : "Sales on track — add marketing numbers to finish the picture";
  } else {
    headline = "Add your numbers";
  }

  const bothNa = marketingStatus === "na" && salesStatus === "na";

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-6 shadow-sm sm:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Diagnosis
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
        {headline}
      </h2>
      <div className="mt-3 max-w-3xl space-y-3 text-base leading-relaxed text-zinc-600">
        {bothNa ? (
          <p>
            Once connection requests and interested are filled in, we’ll break
            down marketing vs sales with more detail.
          </p>
        ) : (
          <>
            <p>{marketingLine(marketingStatus, marketingRate, mk)}</p>
            <p>{salesLine(salesStatus, salesRate, sk)}</p>
          </>
        )}
      </div>
    </div>
  );
}
