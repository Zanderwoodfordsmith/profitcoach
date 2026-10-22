import type { Block } from "../blocks";

/** One part of a script: a row in its left rail and one white page. */
export type ScriptPart = {
  id: string;
  title: string;
  /** One line under the title: what this part does. */
  goal: string;
  blocks: Block[];
  /** Guidance to scan rather than read out: no lines between sections, smaller gaps. */
  tight?: boolean;
};
