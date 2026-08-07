/** Browser-safe Sales Navigator people-search URL check. */

export function isSalesNavSearchUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
      return false;
    }
    return u.pathname.includes("/sales/search/people");
  } catch {
    return false;
  }
}
