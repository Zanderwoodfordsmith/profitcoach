import { ACADEMY_TOURS } from "./academy";
import { BLUEPRINT_TOURS } from "./blueprint";
import { GET_CALLS_TOURS } from "./getCalls";
import { KEEP_CLIENTS_TOURS } from "./keepClients";
import type { PageTourStep } from "./types";
import { WIN_CLIENTS_TOURS } from "./winClients";

export type { PageTourStep } from "./types";

/** "Explore this tab" steps for every area, keyed "area/Tab". */
export const PAGE_TOURS: Record<string, PageTourStep[]> = {
  ...ACADEMY_TOURS,
  ...BLUEPRINT_TOURS,
  ...GET_CALLS_TOURS,
  ...WIN_CLIENTS_TOURS,
  ...KEEP_CLIENTS_TOURS,
};
