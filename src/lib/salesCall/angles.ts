/**
 * Ready-made pitches the coach can start from before pressing Personalise:
 * the standard one, and Pam's five most common angles from her workshop
 * (content/agent/references/pitch-examples.md), written out as spoken words.
 * Each has the nine steps and the three phases. Fill-ins ({name}, {problem},
 * {result}) come from the call details, so they're already partly theirs.
 */

import { PAM_ANGLES } from "./pamAngles";
import { PITCH_PHASES, STANDARD_BRIDGE, STANDARD_RECAP, STANDARD_STEPS, STANDARD_TOGETHER } from "./script";

export type AngleId = "standard" | "customers" | "off-tools" | "profit" | "systems" | "team";

export type PitchAngle = {
  id: AngleId;
  /** A few words for the picker. */
  title: string;
  /** The thread, the way an owner would put their problem. */
  line: string;
  /** Nine spoken paragraphs, one per Profit System step. */
  steps: string[];
  together: string;
  bridge: string;
  /** Three, one per phase. */
  phases: { text: string; check: string }[];
  recap: string;
};

export const ANGLES: PitchAngle[] = [
  {
    id: "standard",
    title: "Standard",
    line: "Works for any owner",
    steps: STANDARD_STEPS,
    together: STANDARD_TOGETHER,
    bridge: STANDARD_BRIDGE,
    phases: PITCH_PHASES.map((p) => ({ text: p.text, check: p.check })),
    recap: STANDARD_RECAP,
  },
  ...PAM_ANGLES,
];

export const ANGLE_IDS = ANGLES.map((a) => a.id);

export function angleById(id: string): PitchAngle {
  return ANGLES.find((a) => a.id === id) ?? ANGLES[0];
}
