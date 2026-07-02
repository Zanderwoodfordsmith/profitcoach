/** When false, all coaches receive Premium-equivalent access regardless of tier. */
export function membershipTierEnforcementEnabled(): boolean {
  return process.env.ENFORCE_MEMBERSHIP_TIERS === "true";
}
