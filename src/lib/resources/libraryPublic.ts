import library from "../../../content/resources/library.public.json";
import type { ResourceGroup } from "./library";

/**
 * The library for members' browsers: titles and block kinds only (see slim.ts).
 * Each block here carries just its `type`; a page's full blocks and text come
 * from /api/academy/resources once the member is signed in.
 */
export const RESOURCE_GROUPS = library.groups as unknown as ResourceGroup[];
