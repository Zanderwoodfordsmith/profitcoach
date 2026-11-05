/**
 * Ava's nudge rules in one place, with no server code, so the admin Nudges
 * tab can show them (5 Nov): who counts as stuck, what Ava says, and where it
 * posts. The checks themselves run in diagnose() in src/lib/coachHealth.ts;
 * NUDGE_RULES says the same in plain words and must be kept in step with it.
 */

/** Why a coach is stuck, in the order coach health checks them. The first that fits is the one they get. */
export const NUDGE_RULES: { reason: string; level: "red" | "amber"; when: string }[] = [
  { reason: "Not logging in", level: "red", when: "Hasn't opened the app for 14 days or more." },
  { reason: "LinkedIn not connected", level: "red", when: "No LinkedIn account connected (and not on Sales Robot)." },
  { reason: "LinkedIn connection broken", level: "red", when: "LinkedIn is connected but has a problem, so campaigns are paused." },
  { reason: "Not sending", level: "red", when: "No invites in the last 7 days and no campaign running (not on Sales Robot)." },
  { reason: "Blueprint not finished", level: "amber", when: "Blueprint not started, still a draft, or the interview isn't done." },
  { reason: "Sending too little", level: "amber", when: "Sent some invites in the last 30 days, but fewer than 200 (not on Sales Robot)." },
  { reason: "Few people accept", level: "amber", when: "100 or more invites in the last 30 days, and fewer than 1 in 10 accept." },
  { reason: "Interest isn't turning into calls", level: "amber", when: "3 or more people interested in the last 30 days, and no calls booked." },
  { reason: "Slow replies", level: "amber", when: "Usually takes more than 4 hours to reply to people." },
];

export type NudgeVars = { first: string; invites_7d: number; accept: string; interested: number };

/** One template per "stuck at" from coach health. Ava speaks to the coach. */
export const NUDGE_TEMPLATES: Record<string, (v: NudgeVars) => string> = {
  "Not logging in": (v) =>
    `Hi ${v.first}, it's Ava. I haven't seen you in the app for a little while. Is something getting in the way? Tell me here and I'll help you pick up where you left off.`,
  "LinkedIn not connected": (v) =>
    `Hi ${v.first}, your campaigns start as soon as LinkedIn is connected. It takes about five minutes in Settings, under Integrations. Want me to walk you through it?`,
  "LinkedIn connection broken": (v) =>
    `Hi ${v.first}, LinkedIn dropped its connection, so your campaigns are paused. Reconnect it in Settings, under Integrations, and they carry on where they stopped.`,
  "Not sending": (v) =>
    `Hi ${v.first}, your campaigns are ready to go but nothing is sending yet. Shall we switch on your first one together? I'll set it up from your Blueprint and you approve it.`,
  "Blueprint not finished": (v) =>
    `Hi ${v.first}, your Blueprint is nearly there. Finish About You and we write the rest for you, campaigns included. It's a few minutes of ticking and tapping.`,
  "Sending too little": (v) =>
    `Hi ${v.first}, you sent ${v.invites_7d} invites this week. The coaches booking calls send 100 or more. Want me to check your daily limits and how many people are left in your list?`,
  "Few people accept": (v) =>
    `Hi ${v.first}, about ${v.accept} of the people you invite accept. Two quick wins: send to Open Profiles first and keep links out of the note. Want me to look over your list with you?`,
  "Interest isn't turning into calls": (v) =>
    `Hi ${v.first}, ${v.interested} people said they're interested this month. Offer two times in your reply and they book far more often. Want me to draft your next few replies?`,
  "Slow replies": (v) =>
    `Hi ${v.first}, people are replying to you. The faster you answer, the more calls you book. Switch on phone alerts in Ava's settings and aim to reply within 30 minutes.`,
};

/** Which Blueprint section thread each nudge belongs in. */
export const NUDGE_SECTION: Record<string, string> = {
  "Not logging in": "story:experience",
  "Blueprint not finished": "story:results",
  "LinkedIn not connected": "linkedin:profile",
  "LinkedIn connection broken": "linkedin:profile",
  "Not sending": "campaigns:messaging",
  "Sending too little": "campaigns:messaging",
  "Few people accept": "campaigns:messaging",
  "Interest isn't turning into calls": "campaigns:conversation",
  "Slow replies": "campaigns:conversation",
};

export function nudgeSection(stuckAt: string): string {
  return NUDGE_SECTION[stuckAt] ?? "story:experience";
}
