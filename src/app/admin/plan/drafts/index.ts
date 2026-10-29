import type { CoachDrafts } from "./types";
import { drafts as buglass } from "./directorschool";
import { drafts as markHennessey } from "./mark-hennessey";
import { drafts as paulHamnett } from "./paul-hamnett";

/** Every coach with drafts to check, by slug. */
export const COACH_DRAFTS: Record<string, CoachDrafts> = {
  [buglass.slug]: buglass,
  [markHennessey.slug]: markHennessey,
  [paulHamnett.slug]: paulHamnett,
};
