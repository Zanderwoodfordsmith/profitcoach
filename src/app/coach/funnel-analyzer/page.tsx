"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  MessageCircle,
  Send,
  ThumbsUp,
  Users,
  Video,
} from "lucide-react";

import { StickyPageHeader } from "@/components/layout";
import { ConnectionVolumePanel } from "@/components/ConnectionVolumePanel";
import {
  connectionRequestsPerWeek,
  connectionVolumeStatus,
  CR_BAR_MAX_PER_WEEK,
  defaultLast30DayWindow,
  greenFloorTotal,
  inclusiveDays,
} from "@/lib/connectionVolume";
import { DiagnosisBanner } from "@/components/DiagnosisBanner";
import { FunnelSliderCard } from "@/components/FunnelSliderCard";
import { HealthInsightSection } from "@/components/HealthInsightSection";
import { HowToGetNumbers } from "@/components/HowToGetNumbers";
import { PriorityActions } from "@/components/PriorityActions";
import {
  choosePriorityStage,
  computeAllStages,
  interestedToClosedRate,
  safeNonNegativeInt,
  sentToClosedRate,
  sentToInterestedRate,
  statusForRate,
  validateMonotonicCounts,
  type FunnelStatus,
} from "@/lib/funnelCompute";
import { DEFAULT_FUNNEL_INPUTS } from "@/lib/funnelDefaults";
import {
  DIAL_MAX_INTERESTED_TO_CLOSED,
  DIAL_MAX_SENT_TO_CLOSED,
  DIAL_MAX_SENT_TO_INTERESTED,
  FUNNEL_STAGE_LABELS,
  INTERESTED_TO_CLOSED_TARGET,
  SENT_TO_CLOSED_TARGET,
  SENT_TO_INTERESTED_TARGET,
  type FunnelCounts,
} from "@/lib/funnelKpis";

type FunnelCountInputs = Record<keyof FunnelCounts, string>;

function toCounts(inputs: FunnelCountInputs): FunnelCounts {
  return {
    sent: safeNonNegativeInt(inputs.sent),
    connected: safeNonNegativeInt(inputs.connected),
    replied: safeNonNegativeInt(inputs.replied),
    interested: safeNonNegativeInt(inputs.interested),
    booked: safeNonNegativeInt(inputs.booked),
    showed: safeNonNegativeInt(inputs.showed),
    closed: safeNonNegativeInt(inputs.closed),
  };
}

function healthLabel(status: FunnelStatus): string {
  switch (status) {
    case "green":
      return "Good";
    case "yellow":
      return "OK";
    case "red":
      return "Below target";
    default:
      return "Add numbers";
  }
}

const COUNT_META: Record<keyof FunnelCounts, { label: string; help: string }> =
  {
    sent: {
      label: "Connection requests",
      help: "Total connection requests between the start and end dates above (same window as every other step).",
    },
    connected: {
      label: "Connected",
      help: "Accepted connections from those requests.",
    },
    replied: {
      label: "Replied",
      help: "Prospects who replied in DMs (same window).",
    },
    interested: {
      label: "Interested",
      help: "Explicit interest (tell me more / yes / what is it).",
    },
    booked: {
      label: "Booked",
      help: "Calls booked from interested prospects.",
    },
    showed: {
      label: "Showed",
      help: "Booked calls where the prospect attended.",
    },
    closed: {
      label: "Closed",
      help: "New clients closed from attended calls.",
    },
  };

const ICONS: Record<keyof FunnelCounts, React.ReactNode> = {
  sent: <Send className="h-6 w-6" />,
  connected: <Users className="h-6 w-6" />,
  replied: <MessageCircle className="h-6 w-6" />,
  interested: <ThumbsUp className="h-6 w-6" />,
  booked: <Calendar className="h-6 w-6" />,
  showed: <Video className="h-6 w-6" />,
  closed: <CheckCircle className="h-6 w-6" />,
};

export default function CoachFunnelAnalyzerPage() {
  const [inputs, setInputs] =
    useState<FunnelCountInputs>(DEFAULT_FUNNEL_INPUTS);
  const [reportRange, setReportRange] = useState(() => defaultLast30DayWindow());
  const reportStart = reportRange.start;
  const reportEnd = reportRange.end;

  const counts = useMemo(() => toCounts(inputs), [inputs]);

  const reportDays = useMemo(
    () => inclusiveDays(reportStart, reportEnd),
    [reportStart, reportEnd],
  );
  const reportWeeks =
    reportDays !== null && reportDays >= 1 ? reportDays / 7 : 0;
  const connectionRequestsPerWeekValue = useMemo(
    () =>
      reportWeeks > 0
        ? connectionRequestsPerWeek(counts.sent, reportWeeks)
        : 0,
    [counts.sent, reportWeeks],
  );
  const connectionVolumeStatusValue: FunnelStatus = useMemo(
    () =>
      reportWeeks > 0
        ? connectionVolumeStatus(connectionRequestsPerWeekValue)
        : "na",
    [connectionRequestsPerWeekValue, reportWeeks],
  );

  const connectionRequestsMax = useMemo(() => {
    if (reportWeeks > 0) {
      const barTotal = Math.ceil(reportWeeks * CR_BAR_MAX_PER_WEEK);
      return Math.max(100, barTotal, counts.sent + 50);
    }
    return Math.max(
      100,
      Math.ceil(((parseInt(inputs.sent) || 0) + 50) / 100) * 100,
    );
  }, [reportWeeks, counts.sent, inputs.sent]);

  const connectionRequestsSubtitle =
    reportWeeks > 0
      ? `TARGET ${Math.round(greenFloorTotal(reportWeeks))}`
      : undefined;

  const issues = useMemo(() => validateMonotonicCounts(counts), [counts]);
  const stages = useMemo(() => computeAllStages(counts), [counts]);
  const priority = useMemo(() => choosePriorityStage(stages), [stages]);

  const sentToInterested = useMemo(
    () => sentToInterestedRate(counts),
    [counts],
  );
  const interestedToClosed = useMemo(
    () => interestedToClosedRate(counts),
    [counts],
  );
  const sentToClosed = useMemo(() => sentToClosedRate(counts), [counts]);

  const marketingStatus = useMemo(
    () => statusForRate(sentToInterested, SENT_TO_INTERESTED_TARGET),
    [sentToInterested],
  );
  const salesStatus = useMemo(
    () => statusForRate(interestedToClosed, INTERESTED_TO_CLOSED_TARGET),
    [interestedToClosed],
  );
  const overallStatus = useMemo(
    () => statusForRate(sentToClosed, SENT_TO_CLOSED_TARGET),
    [sentToClosed],
  );

  const issueByKey = useMemo(() => {
    const map = new Map<keyof FunnelCounts, string>();
    for (const i of issues) map.set(i.key, i.message);
    return map;
  }, [issues]);

  const hasMeaningfulInput = counts.sent > 0;
  const showPrioritySidebar = priority !== null && hasMeaningfulInput;

  const volumePaceWeak =
    reportWeeks > 0 &&
    (connectionVolumeStatusValue === "red" ||
      connectionVolumeStatusValue === "yellow");

  const volumePriorityLead =
    hasMeaningfulInput &&
    priority !== null &&
    volumePaceWeak &&
    (marketingStatus === "green" || overallStatus === "green");

  function onCountChange(key: keyof FunnelCounts, raw: string) {
    const nextRaw = raw.replace(/[^\d]/g, "");
    setInputs((prev) => ({ ...prev, [key]: nextRaw }));
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Funnel Analyzer"
        description="Enter your numbers and get instant KPI feedback. Green means you’re on track, yellow is within 20% of target, red is the constraint to fix first."
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <DiagnosisBanner
          marketingStatus={marketingStatus}
          salesStatus={salesStatus}
          marketingRate={sentToInterested}
          salesRate={interestedToClosed}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <HealthInsightSection
            title="Marketing health"
            statusLabel={healthLabel(marketingStatus)}
            gauge={{
              label: "Connection requests → Interested",
              rate: sentToInterested,
              kpiTarget: SENT_TO_INTERESTED_TARGET,
              dialMax: DIAL_MAX_SENT_TO_INTERESTED,
              status: marketingStatus,
            }}
          />

          <HealthInsightSection
            title="Sales health"
            statusLabel={healthLabel(salesStatus)}
            gauge={{
              label: "Interested → Closed",
              rate: interestedToClosed,
              kpiTarget: INTERESTED_TO_CLOSED_TARGET,
              dialMax: DIAL_MAX_INTERESTED_TO_CLOSED,
              status: salesStatus,
            }}
          />

          <HealthInsightSection
            title="Overall funnel health"
            statusLabel={healthLabel(overallStatus)}
            gauge={{
              label: "Connection requests → Closed",
              rate: sentToClosed,
              kpiTarget: SENT_TO_CLOSED_TARGET,
              dialMax: DIAL_MAX_SENT_TO_CLOSED,
              status: overallStatus,
              percentDecimals: 2,
            }}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div
            className={`flex flex-col gap-6 ${showPrioritySidebar ? "lg:col-span-7" : "lg:col-span-12"}`}
          >
            <div className="flex flex-col gap-4">
              <ConnectionVolumePanel
                connectionRequests={counts.sent}
                startDate={reportStart}
                endDate={reportEnd}
                onStartDateChange={(start) =>
                  setReportRange((r) => ({ ...r, start }))
                }
                onEndDateChange={(end) =>
                  setReportRange((r) => ({ ...r, end }))
                }
              />

              <FunnelSliderCard
                stepNumber={1}
                title={COUNT_META.sent.label}
                description={COUNT_META.sent.help}
                value={inputs.sent}
                onChange={(val) => onCountChange("sent", val)}
                max={connectionRequestsMax}
                rate={null}
                targetRate={null}
                status={connectionVolumeStatusValue}
                countSubtitle={connectionRequestsSubtitle}
                countGoalMarkerPercent={reportWeeks > 0 ? 75 : undefined}
                issueMessage={issueByKey.get("sent")}
                icon={ICONS.sent}
              />

              {stages.map((s, idx) => (
                <FunnelSliderCard
                  key={s.id}
                  stepNumber={idx + 2}
                  title={COUNT_META[s.numeratorKey].label}
                  description={COUNT_META[s.numeratorKey].help}
                  value={inputs[s.numeratorKey]}
                  onChange={(val) => onCountChange(s.numeratorKey, val)}
                  max={s.denominator}
                  rate={s.rate}
                  targetRate={s.kpi}
                  status={s.status}
                  issueMessage={issueByKey.get(s.numeratorKey)}
                  icon={ICONS[s.numeratorKey]}
                />
              ))}
            </div>
          </div>

          {showPrioritySidebar && priority ? (
            <div className="flex flex-col gap-5 lg:col-span-5">
              <PriorityActions
                stage={priority}
                stageLabel={FUNNEL_STAGE_LABELS[priority.id]}
                volumePaceLead={
                  volumePriorityLead &&
                  (connectionVolumeStatusValue === "red" ||
                    connectionVolumeStatusValue === "yellow")
                    ? (connectionVolumeStatusValue as "red" | "yellow")
                    : undefined
                }
              />
            </div>
          ) : null}
        </div>

        <section className="mt-4 w-full max-w-5xl pb-2">
          <HowToGetNumbers />
        </section>
      </div>
    </div>
  );
}
