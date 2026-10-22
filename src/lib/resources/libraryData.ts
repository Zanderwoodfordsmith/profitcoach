import library from "../../../content/resources/library.json";
import { findResourcePageIn, type ResourceGroup, type ResourcePage } from "./library";

/** The full resources library, with sheet and file ids. Server only: members get it through /api/academy/resources. */
export const RESOURCE_GROUPS = library.groups as ResourceGroup[];

export function findResourcePage(slug: string): { page: ResourcePage; group: ResourceGroup } | null {
  return findResourcePageIn(RESOURCE_GROUPS, slug);
}
