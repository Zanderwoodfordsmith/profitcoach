/** en-GB day + short month; year only when not current year. */
export function formatDateDisplay(value: Date): string {
  const currentYear = new Date().getFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(value.getFullYear() === currentYear ? {} : { year: "numeric" }),
  }).format(value);
}
