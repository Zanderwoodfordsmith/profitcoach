/**
 * The Blueprint Call is Pam's call after Ava. It locks one market, one
 * offer, one price, and one angle. It is its own calendar, separate from
 * support.
 * Public page: /advisory-blueprint
 */

export const ADVISORY_BLUEPRINT_CALENDAR_SLUG = "advisory-blueprint" as const;
export const ADVISORY_BLUEPRINT_COACH_SLUG = "pam" as const;
export const ADVISORY_BLUEPRINT_PATH = "/advisory-blueprint" as const;
export const ADVISORY_BLUEPRINT_NAME = "Blueprint Call" as const;

/** Calendar invite title: "Blueprint Call: Jane Smith & Pam". */
export function advisoryBlueprintEventTitle(guestName: string): string {
  const member = guestName.trim() || "Member";
  return `Blueprint Call: ${member} & Pam`;
}
