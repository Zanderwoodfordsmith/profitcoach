"use client";

import {
  StartApplyPanel,
  type ApplyPrefill,
} from "@/components/booking/StartApplyPanel";

type Props = {
  /** Coach public booking slug (e.g. `zander`). */
  slug: string;
  /** Calendar slug (e.g. `discovery`). Defaults to discovery. */
  calendarSlug?: string;
  variant?: "page" | "modal";
  onCalendarChange?: (showing: boolean) => void;
  prefill?: ApplyPrefill;
  enableLeadCapture?: boolean;
  termsHref?: string;
  privacyHref?: string;
};

/**
 * Let’s Talk gate (same UI as GHL `StartApplyPanel`), but Continue unlocks the
 * native day / time / confirmation embed instead of the High Level iframe.
 */
export function StartApplyPanelNative({
  slug,
  calendarSlug = "discovery",
  ...rest
}: Props) {
  return (
    <StartApplyPanel
      {...rest}
      calendar={{ type: "native", slug, calendarSlug }}
    />
  );
}
