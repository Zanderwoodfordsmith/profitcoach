import type { FunnelStatus } from "@/lib/funnelCompute";
import { RadialGauge } from "@/components/RadialGauge";

export function HealthInsightSection({
  title,
  statusLabel,
  gauge,
}: {
  title: string;
  statusLabel: string;
  gauge: {
    label: string;
    rate: number | null;
    kpiTarget: number;
    dialMax: number;
    status: FunnelStatus;
    percentDecimals?: number;
  };
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.022em] text-zinc-900">
        {title}
      </h3>
      <div className="mt-3 flex justify-center">
        <RadialGauge {...gauge} embedded sentimentLabel={statusLabel} />
      </div>
    </div>
  );
}
