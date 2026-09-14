export function shareMessageForLink(title: string, url: string): string {
  const cleanTitle = title.trim() || "this link";
  return `Here’s ${cleanTitle}:\n${url}`;
}

export function shareMessageForAssessment(
  product: "boss-score" | "boss-pro",
  url: string
): string {
  if (product === "boss-pro") {
    return `Here’s the Boss Score Pro assessment — the full diagnostic across the business:\n${url}`;
  }
  return `Here’s the Boss Score — a short scorecard that shows where the profit is leaking:\n${url}`;
}

export function shareMessageForReport(
  product: "boss-score" | "boss-pro",
  url: string
): string {
  if (product === "boss-pro") {
    return `Here’s your Boss Score Pro dashboard:\n${url}`;
  }
  return `Here’s your Boss Score report:\n${url}`;
}

export function shareMessageForCalendar(calendarName: string, url: string): string {
  const name = calendarName.trim() || "a call";
  return `Here’s a link to book a ${name}:\n${url}`;
}
