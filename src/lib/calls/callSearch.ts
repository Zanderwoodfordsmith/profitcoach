import type { CallRow } from "../callRow";
import { getCallStatusLabel } from "../callStatusUi";

export function callMatchesSearch(row: CallRow, rawTerm: string): boolean {
  const term = rawTerm.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    row.prospect_name,
    row.business_name,
    row.prospect_email,
    row.prospect_phone,
    row.title,
    row.calendar_name,
    row.coach_name,
    row.coach_business_name,
    getCallStatusLabel(row.status_normalized),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}
