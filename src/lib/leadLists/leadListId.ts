/**
 * Lead list id check, safe for the browser (list queries stay in audienceLists.ts).
 */

export const LEAD_LIST_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLeadListUuid(value: string): boolean {
  return LEAD_LIST_UUID_RE.test(value);
}
