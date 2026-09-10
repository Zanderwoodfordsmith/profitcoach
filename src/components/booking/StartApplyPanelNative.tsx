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
  /**
   * `discovery` — sales qualify questions (default).
   * `support` — single call-topic notes field.
   */
  intent?: "discovery" | "support";
};

/**
 * Let’s Talk gate (same UI as GHL `StartApplyPanel`), but Continue unlocks the
 * native day / time / confirmation embed instead of the High Level iframe.
 */
export function StartApplyPanelNative({
  slug,
  calendarSlug = "discovery",
  intent = "discovery",
  ...rest
}: Props) {
  return (
    <StartApplyPanel
      {...rest}
      intent={intent}
      calendar={{ type: "native", slug, calendarSlug }}
    />
  );
}
