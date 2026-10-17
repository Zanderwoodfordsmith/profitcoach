/** First explicit boolean among mixed scrape keys. Missing stays null. */
export function optionalLeadFlag(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (value === true || value === 1 || value === "true") return true;
    if (value === false || value === 0 || value === "false") return false;
  }
  return null;
}

export function csvLeadFlag(value: boolean | null | undefined): string {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}
