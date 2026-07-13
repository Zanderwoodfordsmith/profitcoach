/**
 * When false, all coaches receive Premium-equivalent access regardless of tier.
 *
 * Community/calendar RLS uses the matching DB flag `app_runtime_flags.enforce_membership_tiers`
 * (see migration 20260822120000). Flip both when launching memberships:
 *   ENFORCE_MEMBERSHIP_TIERS=true
 *   and set that flag's value to {"enabled": true}.
 */
export function membershipTierEnforcementEnabled(): boolean {
  return process.env.ENFORCE_MEMBERSHIP_TIERS === "true";
}
