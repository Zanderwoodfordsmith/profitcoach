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
   * `support` — a short form, with an optional notes field.
   */
  intent?: "discovery" | "support";
  title?: string;
  lead?: string;
  showNotes?: boolean;
};

/**
 * Let’s Talk gate (same UI as GHL `StartApplyPanel`), but Continue unlocks the
 * native day / time / confirmation embed instead of the High Level iframe.
 */
export function StartApplyPanelNative({
  slug,
  calendarSlug = "discovery",
  intent = "discovery",
  title,
  lead,
  showNotes,
  ...rest
}: Props) {
  return (
    <StartApplyPanel
      {...rest}
      intent={intent}
      title={title}
      lead={lead}
      showNotes={showNotes}
      calendar={{ type: "native", slug, calendarSlug }}
    />
  );
}
